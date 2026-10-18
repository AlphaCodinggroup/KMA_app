import type { SubmissionAnswer } from '@entities/submission/model'
import { sqlitePhotoUploadRepo } from '@core/repos/sqlitePhotoUploadRepo'
import { request } from '@core/http/http'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { isOnlineOnce } from '@shared/lib/network'
import { getCurrentUserId } from '@shared/session/session'
import {
  buildAnswersForApi,
  extractStatus,
  failSubmission,
  isRecoverableStatus,
  readServerVersion,
  readStatus,
  readVersion,
  type AuditAnswerForApi,
  type RemoteAuditResponse,
} from './usecases'
import { AUDIT_DELTA_ENDPOINT, auditCreateItemId, auditDeltaItemId } from '../lib/auditOutbox'
import { buildUploadMap, hasUnuploadedPhotos, indexByLocalUri } from '../lib/photoReadiness'
import {
  diffDeletedStepIds,
  getPendingAnswers,
  markAnswersPending,
  markAnswersSynced,
  parseAnswerSync,
  parseDeletedStepIds,
} from '../lib/auditSyncState'

type DeltaResult = 'success' | 'retry' | 'fail' | 'drop'

/** Conflictos (409) seguidos que se resuelven en el momento; después entra el backoff del outbox. */
const MAX_CONSECUTIVE_CONFLICTS = 3
/** Tope de PATCH por corrida (protege de un loop si el usuario edita sin parar mientras se envía). */
const MAX_ROUNDS = 8

// -----------------------------------------------------------------------------
// Lock: el estado de sync se lee-modifica-escribe desde el runner y desde el SyncService.
// Se serializan en el proceso para que una marca `pending` nueva no pise a un `synced`, ni al revés.
// -----------------------------------------------------------------------------
let lockTail: Promise<unknown> = Promise.resolve()

function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockTail.then(fn, fn)
  lockTail = run.catch(() => undefined)
  return run
}

const serializeMap = (map: Record<string, string>): string => JSON.stringify(map)
const serializeIds = (ids: string[]): string | null => (ids.length > 0 ? JSON.stringify(ids) : null)

function ownerFields(): { userId?: string } {
  const userId = getCurrentUserId()
  return userId ? { userId } : {}
}

// -----------------------------------------------------------------------------
// Escritura: el runner avisa que un paso cambió
// -----------------------------------------------------------------------------

/**
 * Registra el cambio de un paso en una auditoría V2: lo marca `pending`, acumula los pasos podados
 * que el server ya tenía y encola (o reutiliza) el único `AUDIT_DELTA` de la submission.
 * No hace nada si la submission no es V2. Nunca lanza: no debe romper la navegación del runner.
 */
export async function recordAnswerDelta(params: {
  submissionId: string
  stepId: string
  removedStepIds: string[]
}): Promise<void> {
  const { submissionId, stepId, removedStepIds } = params

  try {
    const isV2 = await withSyncLock(async () => {
      const state = await sqliteSubmissionRepo.getSyncState(submissionId)
      if (!state || state.pipeline !== 'v2') return false

      const pruned = diffDeletedStepIds({
        syncMap: parseAnswerSync(state.answerSyncJson),
        removedStepIds,
        deletedStepIds: parseDeletedStepIds(state.deletedStepIdsJson),
      })

      // Un paso re-respondido ya no se borra: sale de la lista de borrados pendientes
      await sqliteSubmissionRepo.saveSyncState(submissionId, {
        answerSyncJson: serializeMap(markAnswersPending(pruned.syncMap, [stepId])),
        deletedStepIdsJson: serializeIds(pruned.deletedStepIds.filter(id => id !== stepId)),
      })
      return true
    })
    if (!isV2) return

    await ensureDeltaQueued(submissionId)
  } catch (err) {
    if (__DEV__) console.warn('[recordAnswerDelta] failed', err)
  }
}

/**
 * Reconcilia el estado de sync con las respuestas guardadas (se llama al darle "Finish"): lo
 * respondido que nunca se registró pasa a `pending`, y lo que ya no está en las respuestas sale del
 * mapa (si el server lo tenía, se agrega a los borrados). Red de seguridad por si algún cambio no
 * pasó por `recordAnswerDelta`. No hace nada si la submission no es V2.
 */
export async function reconcileAnswerSync(
  submissionId: string,
  answers: Record<string, SubmissionAnswer | undefined>,
): Promise<void> {
  await withSyncLock(async () => {
    const state = await sqliteSubmissionRepo.getSyncState(submissionId)
    if (!state || state.pipeline !== 'v2') return

    const answeredIds = Object.keys(answers).filter(id => !!answers[id])
    const current = parseAnswerSync(state.answerSyncJson)

    const pruned = diffDeletedStepIds({
      syncMap: current,
      removedStepIds: Object.keys(current).filter(id => !answeredIds.includes(id)),
      deletedStepIds: parseDeletedStepIds(state.deletedStepIdsJson),
    })
    const untracked = answeredIds.filter(id => !(id in pruned.syncMap))

    await sqliteSubmissionRepo.saveSyncState(submissionId, {
      answerSyncJson: serializeMap(markAnswersPending(pruned.syncMap, untracked)),
      deletedStepIdsJson: serializeIds(
        pruned.deletedStepIds.filter(id => !answeredIds.includes(id)),
      ),
    })
  })
}

/** Encola (o reutiliza) el `AUDIT_DELTA` de la submission, detrás del create, y dispara el sync. */
export async function ensureDeltaQueued(submissionId: string): Promise<void> {
  await sqliteOutboxRepo.enqueueUnique({
    id: auditDeltaItemId(submissionId),
    endpoint: AUDIT_DELTA_ENDPOINT,
    method: 'USECASE',
    payload: { submissionId },
    dependsOn: auditCreateItemId(submissionId),
    ...ownerFields(),
  })
  triggerOutboxSync()
}

/**
 * Qué falta enviar de una auditoría V2: pasos listos para un delta, pasos que esperan a que sus
 * fotos se suban, y borrados de rama pendientes.
 */
export async function getUnsyncedSteps(submissionId: string): Promise<{
  sendable: string[]
  blockedByPhotos: string[]
  deleted: string[]
}> {
  return withSyncLock(async () => {
    const snapshot = await sqliteSubmissionRepo.getById(submissionId)
    const state = await sqliteSubmissionRepo.getSyncState(submissionId)
    const answers = (snapshot?.answers ?? {}) as Record<string, SubmissionAnswer>

    const byLocalUri = indexByLocalUri(await sqlitePhotoUploadRepo.listBySubmission(submissionId))

    const sendable: string[] = []
    const blockedByPhotos: string[] = []
    for (const id of getPendingAnswers(parseAnswerSync(state?.answerSyncJson))) {
      const answer = answers[id]
      if (!answer) continue
      if (hasUnuploadedPhotos(answer, byLocalUri)) blockedByPhotos.push(id)
      else sendable.push(id)
    }

    return {
      sendable,
      blockedByPhotos,
      deleted: parseDeletedStepIds(state?.deletedStepIdsJson),
    }
  })
}

// -----------------------------------------------------------------------------
// Envío: usecase del SyncService para AUDIT_DELTA
// -----------------------------------------------------------------------------

type DeltaPlan = {
  auditId: string
  body: {
    version: number
    answers: AuditAnswerForApi[]
    deleted_step_ids?: string[]
  }
  /** Pasos incluidos en este PATCH y su contenido al armarlo (para no marcar `synced` un cambio posterior). */
  sentStepIds: string[]
  fingerprints: Record<string, string>
  sentDeletedIds: string[]
}

/** Arma el próximo PATCH. `null` = nada que enviar; 'drop' = la submission ya no es V2/no existe. */
async function buildDeltaPlan(
  submissionId: string,
): Promise<DeltaPlan | null | 'drop' | 'no-create'> {
  const snapshot = await sqliteSubmissionRepo.getById(submissionId)
  if (!snapshot || snapshot.pipeline !== 'v2' || !snapshot.auditId) return 'drop'
  // Sin versión confirmada el create todavía no se aplicó
  if (typeof snapshot.serverVersion !== 'number') return 'no-create'

  const state = await sqliteSubmissionRepo.getSyncState(submissionId)
  const syncMap = parseAnswerSync(state?.answerSyncJson)
  const deleted = parseDeletedStepIds(state?.deletedStepIdsJson)
  const answers = snapshot.answers as Record<string, SubmissionAnswer>

  // Un paso con fotos que todavía no están en S3 espera: se envía en cuanto terminen de subirse
  const photoRows = await sqlitePhotoUploadRepo.listBySubmission(submissionId)
  const byLocalUri = indexByLocalUri(photoRows)

  const sentStepIds = getPendingAnswers(syncMap).filter(id => {
    const answer = answers[id]
    return !!answer && !hasUnuploadedPhotos(answer, byLocalUri)
  })
  if (sentStepIds.length === 0 && deleted.length === 0) return null

  const subset: Record<string, SubmissionAnswer> = {}
  const fingerprints: Record<string, string> = {}
  for (const id of sentStepIds) {
    const answer = answers[id]
    if (!answer) continue
    subset[id] = answer
    fingerprints[id] = JSON.stringify(answer)
  }

  return {
    auditId: snapshot.auditId,
    body: {
      version: snapshot.serverVersion,
      answers: buildAnswersForApi({ answers: subset, uploadMap: buildUploadMap(photoRows) }),
      ...(deleted.length > 0 ? { deleted_step_ids: deleted } : {}),
    },
    sentStepIds,
    fingerprints,
    sentDeletedIds: deleted,
  }
}

/** Confirma un PATCH: marca `synced` lo que no cambió mientras viajaba y guarda la versión nueva. */
async function commitDelta(
  submissionId: string,
  plan: DeltaPlan,
  version: number,
  status: string | undefined,
): Promise<void> {
  const fresh = await sqliteSubmissionRepo.getById(submissionId)
  if (fresh) {
    const state = await sqliteSubmissionRepo.getSyncState(submissionId)
    let map = parseAnswerSync(state?.answerSyncJson)

    const unchanged = plan.sentStepIds.filter(
      id => map[id] === 'pending' && JSON.stringify(fresh.answers[id]) === plan.fingerprints[id],
    )
    map = markAnswersSynced(map, unchanged)

    // Un paso que viajaba en este PATCH y se podó mientras tanto ya no está en el mapa: el server
    // acaba de recibir su respuesta, así que hay que borrarlo en el próximo PATCH.
    const prunedInFlight = plan.sentStepIds.filter(
      id => !(id in map) && fresh.answers[id] === undefined,
    )
    const remainingDeleted = Array.from(
      new Set([
        ...parseDeletedStepIds(state?.deletedStepIdsJson).filter(
          id => !plan.sentDeletedIds.includes(id),
        ),
        ...prunedInFlight,
      ]),
    )

    await sqliteSubmissionRepo.saveSyncState(submissionId, {
      answerSyncJson: serializeMap(map),
      deletedStepIdsJson: serializeIds(remainingDeleted),
    })
  }

  await sqliteSubmissionRepo.markServerState(submissionId, {
    serverVersion: version,
    ...(status ? { serverStatus: status } : {}),
  })
}

async function fetchRemoteVersion(auditId: string): Promise<number | null> {
  const remote = await request<RemoteAuditResponse | undefined>({
    method: 'GET',
    url: `/audits/${encodeURIComponent(auditId)}`,
  })
  return readVersion(remote)
}

/**
 * Envía los deltas pendientes de una auditoría V2: un solo `PATCH` con todos los pasos listos y los
 * `deleted_step_ids` acumulados (BE-3, BE-11).
 *
 * - 200 → guarda la versión nueva y marca `synced` lo enviado. Repite si mientras tanto hubo cambios.
 * - 409 → adopta `server_version` y reenvía lo mismo; máx. 3 seguidos y después backoff (BE-10).
 *   Nunca se descarta la auditoría ni se pisa el server a ciegas.
 * - 404 / red / 5xx / 401 / 403 / 429 / 408 → 'retry'. Otro 4xx → 'fail'.
 * - Los pasos con fotos locales quedan `pending` y esperan a que D2 las suba (no es un error).
 */
export async function syncAuditDeltas(submissionId: string): Promise<DeltaResult> {
  if (!(await isOnlineOnce())) return 'retry'

  let conflicts = 0

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const plan = await withSyncLock(() => buildDeltaPlan(submissionId))
    if (plan === 'drop') return 'drop'
    if (plan === 'no-create') return 'retry'
    if (plan === null) return 'success'

    try {
      const res = await request<RemoteAuditResponse | undefined>({
        method: 'PATCH',
        url: `/audits/${encodeURIComponent(plan.auditId)}`,
        data: plan.body,
      })
      let version = readVersion(res)
      if (version === null) {
        // El PATCH ya se aplicó: un fallo de este GET no lo convierte en un PATCH fallido
        try {
          version = await fetchRemoteVersion(plan.auditId)
        } catch {
          version = null
        }
      }
      // Aplicado pero sin versión confiable: el próximo intento chocará (409) y se reconcilia
      if (version === null) return 'retry'

      await withSyncLock(() => commitDelta(submissionId, plan, version, readStatus(res)))
      conflicts = 0
    } catch (err) {
      const status = extractStatus(err)

      if (status === 409) {
        conflicts++
        if (conflicts >= MAX_CONSECUTIVE_CONFLICTS) return 'retry'

        let serverVersion = readServerVersion(err)
        if (serverVersion === null) {
          try {
            serverVersion = await fetchRemoteVersion(plan.auditId)
          } catch {
            serverVersion = null
          }
        }
        if (serverVersion === null) return 'retry'

        await sqliteSubmissionRepo.markServerState(submissionId, { serverVersion })
        continue
      }

      // 404: el create todavía no existe en el server
      if (status === 404 || isRecoverableStatus(status)) {
        if (__DEV__) console.warn('[syncAuditDeltas] retryable error', status, err)
        return 'retry'
      }

      if (__DEV__) console.warn('[syncAuditDeltas] fail (4xx)', status, err)
      await failSubmission(submissionId, err)
      return 'fail'
    }
  }

  // Siguió habiendo cambios después de varias vueltas: se retoma en el próximo intento
  return 'retry'
}
