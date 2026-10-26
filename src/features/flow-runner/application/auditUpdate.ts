import * as FileSystem from 'expo-file-system'

import type { AuditAnswer } from '@entities/audit/model'
import { isAuditEditable } from '@entities/audit/lib/status'
import { photoUploadName } from '@entities/submission/lib/photos'
import { request } from '@core/http/http'
import { expoFileUploader } from '@core/http/fileUploader'
import { sqliteAuditRepo } from '@core/repos/sqliteAuditRepo'
import { isOnlineOnce } from '@shared/lib/network'
import { getCurrentUserId } from '@shared/session/session'
import { showAppToast } from '@shared/ui/toast/AppToast'
import {
  extractStatus,
  guessMimeFromExt,
  isRecoverableStatus,
  readServerVersion,
  readStatus,
  readVersion,
  type AuditAnswerForApi,
  type PresignResponse,
  type RemoteAuditResponse,
} from './usecases'

type UpdateResult = 'success' | 'retry' | 'drop'

/** Conflictos (409) seguidos que se resuelven en el momento; después entra el backoff del outbox. */
const MAX_CONSECUTIVE_CONFLICTS = 3
/** Tope de PATCH por corrida (protege de un loop si el auditor sigue editando mientras se envía). */
const MAX_ROUNDS = 5
/** Máximo de fotos por `POST /uploads` (BE-2). */
const MAX_FILES_PER_PRESIGN = 20

const answerToApi = (a: AuditAnswer): AuditAnswerForApi =>
  a.type === 'Form'
    ? { step_id: a.stepId, type: 'Form', values: a.values ?? {} }
    : {
        step_id: a.stepId,
        type: a.type === 'Select' ? 'Select' : 'Question',
        answer: typeof a.answer === 'string' ? a.answer : null,
      }

type LocalPhoto = { stepId: string; uri: string; name: string }

/** Fotos `file://` de las respuestas editadas (las únicas que hay que subir). */
function localPhotosOf(answers: AuditAnswer[]): LocalPhoto[] {
  const out: LocalPhoto[] = []
  for (const a of answers) {
    const photos = a.values?.photos
    if (!Array.isArray(photos)) continue
    for (const p of photos) {
      if (typeof p === 'string' && p.startsWith('file://')) {
        out.push({ stepId: a.stepId, uri: p, name: photoUploadName(a.stepId, 'photos', p) })
      }
    }
  }
  return out
}

/**
 * Marca la edición como rechazada: se conserva en el teléfono (`failed`) y el auditor la ve en la
 * lista con "Sync failed". Una nueva edición o un Retry la vuelven a encolar.
 */
async function failEdit(userId: string, auditId: string, err: unknown): Promise<UpdateResult> {
  if (__DEV__) console.warn('[syncAuditUpdate] fail', extractStatus(err), err)
  await sqliteAuditRepo.setEditState(userId, auditId, 'failed')
  showAppToast({
    type: 'error',
    title: 'Edit not sent',
    message: 'An edited audit could not be sent. Open Review completed to retry.',
  })
  return 'drop'
}

/**
 * Sube las fotos nuevas de la edición y reescribe sus respuestas con la URL remota (así un
 * reintento retoma donde quedó). `PUT` repetido a la misma key es idempotente.
 */
async function uploadLocalPhotos(
  userId: string,
  auditId: string,
  photos: LocalPhoto[],
): Promise<'ok' | 'retry' | 'fail'> {
  for (let i = 0; i < photos.length; i += MAX_FILES_PER_PRESIGN) {
    const batch = photos.slice(i, i + MAX_FILES_PER_PRESIGN)

    let presign: PresignResponse
    try {
      presign = await request<PresignResponse>({
        method: 'POST',
        url: '/uploads',
        data: {
          audit_id: auditId,
          files: batch.map(p => ({
            name: p.name,
            step_id: p.stepId,
            content_type: guessMimeFromExt(p.name.split('.').pop() ?? 'jpg'),
          })),
        },
      })
    } catch (err) {
      const status = extractStatus(err)
      return status === 404 || isRecoverableStatus(status) ? 'retry' : 'fail'
    }

    const byName = new Map(presign.urls.map(u => [u.file_name, u]))
    for (const photo of batch) {
      const entry = byName.get(photo.name)
      if (!entry?.upload_url || !entry.file_url) return 'retry'

      const info = await FileSystem.getInfoAsync(photo.uri)
      if (!info.exists) return 'fail'

      try {
        await expoFileUploader.upload({
          url: entry.upload_url,
          localUri: photo.uri,
          contentType: guessMimeFromExt(photo.name.split('.').pop() ?? 'jpg'),
        })
      } catch (err) {
        const status = extractStatus(err)
        // 403 = presign vencido: el próximo intento pide uno nuevo (la URI sigue siendo local)
        return isRecoverableStatus(status) ? 'retry' : 'fail'
      }

      await sqliteAuditRepo.replacePhotoUris(userId, auditId, { [photo.uri]: entry.file_url })
      // Ya subida y reescrita en la respuesta: el archivo local no se vuelve a usar
      await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => undefined)
    }
  }
  return 'ok'
}

async function fetchRemote(auditId: string): Promise<RemoteAuditResponse | null> {
  try {
    return (
      (await request<RemoteAuditResponse | undefined>({
        method: 'GET',
        url: `/audits/${encodeURIComponent(auditId)}`,
      })) ?? null
    )
  } catch {
    return null
  }
}

/**
 * Envía la edición de una auditoría ya enviada: sube las fotos nuevas y manda un único
 * `PATCH /audits/{id}` con `{ version, answers (sólo los pasos cambiados), deleted_step_ids, edited_at }`.
 *
 * - 200 → guarda la versión nueva; queda `synced` salvo que se haya vuelto a editar (otra vuelta).
 * - 409 → adopta `server_version` y reenvía los mismos pasos (el último en escribir gana, paso a
 *   paso) con aviso al auditor; máx. 3 seguidos y después backoff.
 * - 400 → si la auditoría ya no está en un estado editable pasó a revisión: la edición queda
 *   `locked` en el teléfono (no se pierde ni se reintenta). Si sigue editable es un rechazo real: `failed`.
 * - Red / 5xx / 401 / 403 / 429 / 408 / 404 → 'retry'. Otro 4xx → `failed`.
 */
export async function syncAuditUpdate(auditId: string): Promise<UpdateResult> {
  const userId = getCurrentUserId()
  if (!userId) return 'drop'
  if (!(await isOnlineOnce())) return 'retry'

  let conflicts = 0
  let adoptedVersion = false

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const audit = await sqliteAuditRepo.getById(userId, auditId)
    // Sólo se envía lo pendiente: synced / failed / locked no tienen nada que hacer acá
    if (!audit || audit.syncState !== 'pending' || !audit.answers || audit.editedAt == null) {
      return 'success'
    }

    const photos = localPhotosOf(audit.answers)
    if (photos.length > 0) {
      const uploaded = await uploadLocalPhotos(userId, auditId, photos)
      if (uploaded === 'retry') return 'retry'
      if (uploaded === 'fail') return failEdit(userId, auditId, new Error('photo upload failed'))
    }

    // Se relee: las fotos subidas reescribieron las respuestas
    const fresh = photos.length > 0 ? await sqliteAuditRepo.getById(userId, auditId) : audit
    if (!fresh || fresh.syncState !== 'pending' || !fresh.answers || fresh.editedAt == null) {
      return 'success'
    }
    const editedAt = fresh.editedAt

    const changed = new Set(fresh.changedStepIds ?? [])
    const answers = fresh.answers.filter(a => changed.has(a.stepId)).map(answerToApi)
    const deleted = fresh.deletedStepIds ?? []

    if (answers.length === 0 && deleted.length === 0) {
      await sqliteAuditRepo.ackEdit(userId, auditId, { editedAt, version: fresh.version })
      return 'success'
    }

    try {
      const res = await request<RemoteAuditResponse | undefined>({
        method: 'PATCH',
        url: `/audits/${encodeURIComponent(auditId)}`,
        data: {
          version: fresh.version,
          answers,
          ...(deleted.length > 0 ? { deleted_step_ids: deleted } : {}),
          edited_at: new Date(editedAt).toISOString(),
        },
      })

      // El PATCH ya se aplicó: sin versión en la respuesta se lee del backend; si tampoco, se
      // supone +1 (reenviar el mismo PATCH daría un 409 falso; si la suposición falla, el próximo
      // PATCH choca con 409 y se reconcilia)
      const version =
        readVersion(res) ?? readVersion(await fetchRemote(auditId)) ?? fresh.version + 1

      const synced = await sqliteAuditRepo.ackEdit(userId, auditId, {
        editedAt,
        version,
        status: readStatus(res),
      })
      conflicts = 0
      if (synced) {
        if (adoptedVersion) {
          showAppToast({
            type: 'info',
            title: 'Audit updated elsewhere',
            message: 'Your changes were applied on top of the latest version.',
          })
        }
        return 'success'
      }
      // Se volvió a editar mientras viajaba: sigue `pending`, otra vuelta con lo nuevo
    } catch (err) {
      const status = extractStatus(err)

      if (status === 409) {
        conflicts++
        if (conflicts >= MAX_CONSECUTIVE_CONFLICTS) return 'retry'

        const serverVersion = readServerVersion(err) ?? readVersion(await fetchRemote(auditId))
        if (serverVersion === null) return 'retry'

        await sqliteAuditRepo.setVersion(userId, auditId, serverVersion)
        adoptedVersion = true
        continue
      }

      if (status === 400) {
        const remote = await fetchRemote(auditId)
        const remoteStatus = readStatus(remote)
        if (!remoteStatus) return 'retry'

        if (!isAuditEditable(remoteStatus)) {
          await sqliteAuditRepo.setEditState(userId, auditId, 'locked', remoteStatus)
          showAppToast({
            type: 'error',
            title: 'Audit under review',
            message: 'This audit is already under review. Your edit was kept but not sent.',
          })
          return 'success'
        }
        return failEdit(userId, auditId, err)
      }

      if (status === 404 || isRecoverableStatus(status)) {
        if (__DEV__) console.warn('[syncAuditUpdate] retryable error', status, err)
        return 'retry'
      }

      return failEdit(userId, auditId, err)
    }
  }

  // Siguió habiendo cambios después de varias vueltas: se retoma en el próximo intento
  return 'retry'
}
