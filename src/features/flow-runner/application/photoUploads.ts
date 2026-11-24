import * as FileSystem from 'expo-file-system'

import type { PhotoUpload } from '@entities/photo/model'
import type { SubmissionSnapshot } from '@entities/submission/ports'
import {
  PHOTO_FIELD_KEYS,
  photoRowId,
  photoUploadName,
  photoUriOf,
} from '@entities/submission/lib/photos'
import { request } from '@core/http/http'
import { expoFileUploader } from '@core/http/fileUploader'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { sqlitePhotoUploadRepo } from '@core/repos/sqlitePhotoUploadRepo'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { discardPhoto } from '@features/camera'
import { Env } from '@shared/config/env'
import { isOnlineOnce } from '@shared/lib/network'
import {
  extractStatus,
  failSubmission,
  guessMimeFromExt,
  isRecoverableStatus,
  ownerFields,
  type PresignResponse,
} from './usecases'
import { ensureDeltaQueued } from './auditDeltas'
import { PHOTO_UPLOAD_ENDPOINT, auditCreateItemId, photoUploadItemId } from '../lib/auditOutbox'

type PhotoUploadResult = 'success' | 'retry' | 'fail' | 'drop'

/** Máximo de fotos por `POST /uploads` (BE-2). */
const MAX_FILES_PER_PRESIGN = 20
/** Vencimiento por defecto del presign si el backend no lo informa (15 min, BE-2). */
const DEFAULT_PRESIGN_TTL_MS = 15 * 60_000
/** Un presign que vence en menos de esto se vuelve a pedir en vez de arriesgar un 403. */
const PRESIGN_SAFETY_MARGIN_MS = 60_000

// -----------------------------------------------------------------------------
// Registro de fotos (D1)
// -----------------------------------------------------------------------------

/**
 * Registra en `photo_uploads` una foto recién capturada (queda `pending`). Con
 * `PHOTO_BACKGROUND_UPLOAD` y una auditoría V2, además encola su subida de inmediato; sin el flag
 * la tabla sólo se llena y las fotos suben al darle "Finish". Nunca lanza: si falla, la foto igual
 * vive en el form y se registra en el próximo arranque.
 */
export async function registerCapturedPhoto(params: {
  submissionId: string
  stepId: string
  fieldId: string
  uri: string
}): Promise<void> {
  try {
    const id = photoRowId(params.submissionId, params.uri)
    await sqlitePhotoUploadRepo.register({
      id,
      submissionId: params.submissionId,
      stepId: params.stepId,
      fieldId: params.fieldId,
      localUri: params.uri,
      uploadName: photoUploadName(params.stepId, params.fieldId, params.uri),
    })

    if (Env.flags.photoBackgroundUpload) {
      const state = await sqliteSubmissionRepo.getSyncState(params.submissionId)
      if (state?.pipeline === 'v2') {
        await enqueuePhotoUpload(id, params.submissionId)
        triggerOutboxSync()
      }
    }
  } catch (err) {
    if (__DEV__) console.warn('[registerCapturedPhoto] No se pudo registrar la foto', err)
  }
}

/**
 * Rama abandonada: las filas `pending` de los pasos que la nueva respuesta dejó afuera ya no
 * corresponden a ninguna respuesta. Nunca lanza.
 */
export async function discardPrunedPhotos(
  submissionId: string,
  removedStepIds: readonly string[],
): Promise<void> {
  if (removedStepIds.length === 0) return
  try {
    await sqlitePhotoUploadRepo.deletePendingByStepIds(submissionId, removedStepIds)
  } catch (err) {
    if (__DEV__) console.warn('[discardPrunedPhotos] No se pudo depurar photo_uploads', err)
  }
}

/** El auditor quitó una foto del form: se borra el archivo y su fila de `photo_uploads`. */
export async function discardCapturedPhoto(uri: string): Promise<void> {
  await discardPhoto(uri)
  await sqlitePhotoUploadRepo.deleteByLocalUri(uri).catch(() => undefined)
}

/**
 * Registra las fotos locales (`file://`) de una submission que todavía no tengan fila. Idempotente:
 * el id es el nombre base del archivo y `register` no pisa una fila existente.
 */
export async function registerSubmissionPhotos(snap: SubmissionSnapshot): Promise<void> {
  for (const [stepId, ans] of Object.entries(snap.answers ?? {})) {
    if (!ans || ans.type !== 'Form') continue

    for (const fieldId of PHOTO_FIELD_KEYS) {
      const list = ans.values?.[fieldId]
      if (!Array.isArray(list)) continue

      for (const p of list) {
        const uri = photoUriOf(p)
        if (!uri.startsWith('file://')) continue

        await sqlitePhotoUploadRepo.register({
          id: photoRowId(snap.id, uri),
          submissionId: snap.id,
          stepId,
          fieldId,
          localUri: uri,
          uploadName: photoUploadName(stepId, fieldId, uri),
          ...(snap.auditId ? { auditId: snap.auditId } : {}),
        })
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Encolado
// -----------------------------------------------------------------------------

async function enqueuePhotoUpload(photoId: string, submissionId: string): Promise<void> {
  await sqliteOutboxRepo.enqueueUnique({
    id: photoUploadItemId(photoId),
    endpoint: PHOTO_UPLOAD_ENDPOINT,
    method: 'USECASE',
    payload: { photoId, submissionId },
    // Nada se sube a una auditoría que todavía no existe en el server (BE-2)
    dependsOn: auditCreateItemId(submissionId),
    ...ownerFields(),
  })
}

/**
 * Encola la subida de todas las fotos de la submission que no estén `uploaded`. También registra
 * las que no tuvieran fila. No hace nada si la submission no es V2. Un item por foto: si una falla,
 * el resto de la auditoría no se reintenta desde cero.
 */
export async function enqueuePhotoUploads(submissionId: string): Promise<void> {
  const snapshot = await sqliteSubmissionRepo.getById(submissionId)
  if (!snapshot || snapshot.pipeline !== 'v2') return

  await registerSubmissionPhotos(snapshot)

  const rows = await sqlitePhotoUploadRepo.listBySubmission(submissionId)
  const pending = rows.filter(row => row.status !== 'uploaded')
  if (pending.length === 0) return

  for (const row of pending) await enqueuePhotoUpload(row.id, submissionId)
  triggerOutboxSync()
}

// -----------------------------------------------------------------------------
// Subida (usecase del SyncService para PHOTO_UPLOAD)
// -----------------------------------------------------------------------------

const hasValidPresign = (photo: PhotoUpload): boolean =>
  !!photo.uploadUrl &&
  !!photo.remoteUrl &&
  typeof photo.expiresAt === 'number' &&
  photo.expiresAt - PRESIGN_SAFETY_MARGIN_MS > Date.now()

const contentTypeOf = (photo: PhotoUpload): string =>
  guessMimeFromExt(photo.uploadName.split('.').pop() ?? 'jpg')

/**
 * Pide el presign de `photo` y, ya que hay request, de otras fotos de la misma auditoría que lo
 * necesiten (hasta 20 por `POST /uploads`). Nunca se llama con `files` vacío.
 * Devuelve el resultado del item si no se pudo, o null si la foto quedó con presign.
 */
async function presign(auditId: string, photo: PhotoUpload): Promise<PhotoUploadResult | null> {
  const siblings = (await sqlitePhotoUploadRepo.listBySubmission(photo.submissionId)).filter(
    p =>
      p.id !== photo.id &&
      p.status !== 'uploaded' &&
      p.status !== 'uploading' &&
      !hasValidPresign(p),
  )
  const batch = [photo, ...siblings].slice(0, MAX_FILES_PER_PRESIGN)

  try {
    const res = await request<PresignResponse>({
      method: 'POST',
      url: '/uploads',
      data: {
        audit_id: auditId,
        files: batch.map(p => ({
          name: p.uploadName,
          step_id: p.stepId,
          content_type: contentTypeOf(p),
        })),
      },
    })

    const byName = new Map(res.urls.map(u => [u.file_name, u]))
    for (const p of batch) {
      const entry = byName.get(p.uploadName)
      if (!entry?.upload_url || !entry.file_url) continue
      await sqlitePhotoUploadRepo.savePresign(p.id, {
        uploadUrl: entry.upload_url,
        remoteUrl: entry.file_url,
        expiresAt:
          typeof entry.expires_at === 'number'
            ? entry.expires_at * 1000
            : Date.now() + DEFAULT_PRESIGN_TTL_MS,
      })
    }

    // Sin URL para esta foto: nunca se sube a ciegas, se reintenta
    return byName.get(photo.uploadName)?.upload_url ? null : 'retry'
  } catch (err) {
    const status = extractStatus(err)
    // 404: el create todavía no se aplicó en el server
    if (status === 404 || isRecoverableStatus(status)) return 'retry'
    await sqlitePhotoUploadRepo.markFailed(photo.id, `presign HTTP ${status ?? '?'}`)
    await failSubmission(photo.submissionId, err)
    return 'fail'
  }
}

/** Avisa que una foto terminó: destraba los pasos que la esperaban (delta) y el submit diferido. */
async function onPhotoUploaded(submissionId: string): Promise<void> {
  await sqliteOutboxRepo.wakeSubmissionItems(submissionId)
  await ensureDeltaQueued(submissionId)
}

/**
 * Sube una foto: presign (si no tiene uno vigente) → `PUT` binario → `uploaded`.
 *
 * - Fila inexistente / submission que ya no es V2 → 'drop'.
 * - `404` del presign, red, 5xx, 429, o presign vencido (403 de S3, se re-firma una vez) → 'retry'.
 * - Archivo local que ya no existe, o 4xx no recuperable → 'fail' (foto `failed`, submission
 *   `failed` con Retry).
 * - Un `PUT` repetido a la misma key es idempotente: matar la app durante la subida no duplica nada.
 */
export async function uploadPhotoItem(photoId: string): Promise<PhotoUploadResult> {
  const photo = await sqlitePhotoUploadRepo.getById(photoId)
  if (!photo) return 'drop'

  const snapshot = await sqliteSubmissionRepo.getById(photo.submissionId)
  if (!snapshot || snapshot.pipeline !== 'v2' || !snapshot.auditId) return 'drop'

  if (photo.status === 'uploaded') {
    await onPhotoUploaded(photo.submissionId)
    return 'success'
  }

  if (typeof snapshot.serverVersion !== 'number') return 'retry'
  if (!(await isOnlineOnce())) return 'retry'

  const info = await FileSystem.getInfoAsync(photo.localUri)
  if (!info.exists) {
    await sqlitePhotoUploadRepo.markFailed(photo.id, 'photo_missing')
    await failSubmission(photo.submissionId, {
      response: {
        data: { error: 'photo_missing', message: 'A photo is no longer on this device.' },
      },
    })
    return 'fail'
  }

  for (let pass = 0; pass < 2; pass++) {
    let current = await sqlitePhotoUploadRepo.getById(photo.id)
    if (!current) return 'drop'

    if (!hasValidPresign(current)) {
      const outcome = await presign(snapshot.auditId, current)
      if (outcome) return outcome
      current = await sqlitePhotoUploadRepo.getById(photo.id)
      if (!current?.uploadUrl || !current.remoteUrl) return 'retry'
    }

    const { uploadUrl, remoteUrl } = current
    if (!uploadUrl || !remoteUrl) return 'retry'

    await sqlitePhotoUploadRepo.markUploading(photo.id)
    try {
      await expoFileUploader.upload({
        url: uploadUrl,
        localUri: current.localUri,
        contentType: contentTypeOf(current),
      })
    } catch (err) {
      const status = extractStatus(err)

      // 403 = presign vencido o inválido: se descarta y se re-firma sólo esta foto
      if (status === 403 && pass === 0) {
        await sqlitePhotoUploadRepo.clearPresign(photo.id)
        await sqlitePhotoUploadRepo.markRetry(photo.id, 'presign expired')
        continue
      }

      if (isRecoverableStatus(status)) {
        await sqlitePhotoUploadRepo.markRetry(photo.id, `upload HTTP ${status ?? 'network'}`)
        return 'retry'
      }

      await sqlitePhotoUploadRepo.markFailed(photo.id, `upload HTTP ${status ?? '?'}`)
      await failSubmission(photo.submissionId, err)
      return 'fail'
    }

    await sqlitePhotoUploadRepo.markUploaded(photo.id, remoteUrl)
    await onPhotoUploaded(photo.submissionId)
    return 'success'
  }

  return 'retry'
}
