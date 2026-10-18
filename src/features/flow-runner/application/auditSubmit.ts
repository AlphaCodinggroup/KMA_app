import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import { request } from '@core/http/http'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { isOnlineOnce } from '@shared/lib/network'
import { showAuditCreatedToast, showAuditProcessingToast } from '@shared/ui/toast/AppToast'
import type { SubmissionSnapshot } from '@entities/submission/ports'
import {
  extractStatus,
  failSubmission,
  finalizeSubmission,
  isRecoverableStatus,
  ownerFields,
  readServerVersion,
  readStatus,
  readVersion,
  type RemoteAuditResponse,
} from './usecases'
import { ensureDeltaQueued, getUnsyncedSteps, reconcileAnswerSync } from './auditDeltas'
import { enqueuePhotoUploads } from './photoUploads'
import { AUDIT_SUBMIT_ENDPOINT, auditDeltaItemId, auditSubmitItemId } from '../lib/auditOutbox'

type SubmitRemoteResult = 'success' | 'retry' | 'fail' | 'defer'

/** Estado que el backend asigna al auditar el submit si la respuesta no lo trae (BE-6). */
const STATUS_AFTER_SUBMIT = 'draft_report_pending_review'

type FinalizeParams = Parameters<typeof finalizeSubmission>[0]

/**
 * "Finish" del runner. Una auditoría V2 se cierra con el `AUDIT_SUBMIT`; una v1 (incluida
 * cualquiera creada con el flag apagado) sigue por el `AUDIT_SUBMISSION` de siempre.
 * La decisión sale del `pipeline` persistido de la fila, no del flag.
 */
export async function finalizeAudit(params: FinalizeParams): Promise<boolean> {
  const state = await sqliteSubmissionRepo.getSyncState(params.submissionId)
  if (state?.pipeline === 'v2') return finishAuditV2(params)
  return finalizeSubmission(params)
}

/**
 * V2: guarda las respuestas finales y encola `AUDIT_SUBMIT`. No espera a la red: el orden create →
 * deltas → submit lo garantiza el `depends_on` del outbox.
 */
async function finishAuditV2(params: FinalizeParams): Promise<boolean> {
  const { submissionId } = params

  const draft: SubmissionDraft = {
    flowId: params.flowId,
    title: params.title,
    createdAt: Date.now(),
    answers: params.answers as Record<string, SubmissionAnswer>,
  }

  await sqliteSubmissionRepo.saveDraft({
    id: submissionId,
    draft,
    projectId: params.projectId ?? '',
    facilityId: params.facilityId ?? '',
    version: params.version ?? '',
    ...ownerFields(),
  })

  showAuditProcessingToast(params.title)

  // Red de seguridad: lo respondido que no pasó por `recordAnswerDelta` se marca pendiente
  await reconcileAnswerSync(submissionId, draft.answers)

  // Sin subida en background, las fotos suben ahora (con background ya estarán `uploaded`)
  await enqueuePhotoUploads(submissionId)

  await enqueueAuditSubmitChain(submissionId)
  return true
}

/**
 * Deja encolada la cadena create → delta → submit de una submission V2 y la marca `queued`.
 * Idempotente: se puede llamar de nuevo sin duplicar items. También la usa el dispatcher para
 * reencauzar una fila V2 que llegue por el camino v1 (ver `handleAuditSubmissionItem`).
 */
export async function enqueueAuditSubmitChain(submissionId: string): Promise<void> {
  // Revive create/delta que hubieran quedado `failed` mientras se editaba
  await sqliteOutboxRepo.requeueBySubmissionId(submissionId)
  // Garantiza un delta en la cola: el submit cuelga de él, así la cadena es create → delta → submit
  await ensureDeltaQueued(submissionId)

  await sqliteOutboxRepo.enqueueUnique({
    id: auditSubmitItemId(submissionId),
    endpoint: AUDIT_SUBMIT_ENDPOINT,
    method: 'USECASE',
    payload: { submissionId },
    dependsOn: auditDeltaItemId(submissionId),
    ...ownerFields(),
  })

  await sqliteSubmissionRepo.markStatus(submissionId, 'queued')
  triggerOutboxSync()
}

/**
 * Usecase del SyncService para `AUDIT_SUBMIT`: `POST /audits/{id}/submit` (BE-6).
 *
 * - No envía mientras haya algo sin sincronizar: si quedan deltas, los re-encola y reintenta.
 * - Pasos que esperan fotos locales → 'defer' (sin gastar intentos; los destraba D2).
 * - 2xx → guarda `server_version` / `server_status` (sin `GET` extra). Idempotente: si el estado
 *   local ya salió de `audit_in_progress`, el submit ya se hizo y no se repite.
 * - 409 → adopta `server_version` y reintenta. 404 / red / 5xx / 401 / 403 / 429 / 408 → 'retry'.
 * - Otro 4xx (p. ej. el 400 de "borrador incompleto", BE-20) → 'fail': la submission queda `failed`
 *   con el mensaje del backend y su Retry en la UI.
 */
export async function submitRemoteAudit(snapshot: SubmissionSnapshot): Promise<SubmitRemoteResult> {
  const auditId = snapshot.auditId
  if (snapshot.pipeline !== 'v2' || !auditId) return 'fail'

  // Submit ya aplicado en una corrida anterior (se perdió el ack del item)
  if (snapshot.serverStatus && snapshot.serverStatus !== 'audit_in_progress') return 'success'

  if (typeof snapshot.serverVersion !== 'number') return 'retry'
  if (!(await isOnlineOnce())) return 'retry'

  const pending = await getUnsyncedSteps(snapshot.id)
  if (pending.sendable.length > 0 || pending.deleted.length > 0) {
    await ensureDeltaQueued(snapshot.id)
    return 'retry'
  }
  if (pending.blockedByPhotos.length > 0) {
    // Espera a las fotos sin gastar intentos; cada foto que termina despierta este item.
    // Si alguna no tuviera su subida encolada, se encola ahora.
    await enqueuePhotoUploads(snapshot.id)
    return 'defer'
  }

  try {
    const res = await request<RemoteAuditResponse | undefined>({
      method: 'POST',
      url: `/audits/${encodeURIComponent(auditId)}/submit`,
      data: {},
    })

    await sqliteSubmissionRepo.markServerState(snapshot.id, {
      serverVersion: readVersion(res) ?? snapshot.serverVersion,
      serverStatus: readStatus(res) ?? STATUS_AFTER_SUBMIT,
    })
    showAuditCreatedToast(snapshot.title)
    return 'success'
  } catch (err) {
    const status = extractStatus(err)

    if (status === 409) {
      const serverVersion = readServerVersion(err)
      if (serverVersion !== null) {
        await sqliteSubmissionRepo.markServerState(snapshot.id, { serverVersion })
      }
      return 'retry'
    }

    if (status === 404 || isRecoverableStatus(status)) {
      if (__DEV__) console.warn('[submitRemoteAudit] retryable error', status, err)
      return 'retry'
    }

    if (__DEV__) console.warn('[submitRemoteAudit] fail (4xx)', status, err)
    await failSubmission(snapshot.id, err)
    return 'fail'
  }
}
