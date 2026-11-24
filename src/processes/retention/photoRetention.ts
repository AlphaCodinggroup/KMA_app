import * as FileSystem from 'expo-file-system'

import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqlitePhotoUploadRepo } from '@core/repos/sqlitePhotoUploadRepo'
import { discardPhotoGroup } from '@features/camera'
import { LOW_DISK_BYTES, getFreeDiskBytes } from '@shared/lib/diskSpace'
import type { PhotoUpload } from '@entities/photo/model'
import type { SubmissionAnswer } from '@entities/submission/model'
import { PHOTO_FIELD_KEYS, photoUriOf, withPhotoUri } from '@entities/submission/lib/photos'
import { decideRetention, isRetentionDue, type RetentionCandidate } from './policy'

/** Auditorías que se procesan antes de ceder el hilo (la limpieza no debe trabar la UI). */
const BATCH_SIZE = 10

const LAST_RUN_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}kma/retention-last-run.txt`
  : null

let running = false

async function readLastRun(): Promise<number | null> {
  if (!LAST_RUN_FILE) return null
  try {
    const n = Number(await FileSystem.readAsStringAsync(LAST_RUN_FILE))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

async function writeLastRun(now: number): Promise<void> {
  if (!LAST_RUN_FILE) return
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}kma`, {
      intermediates: true,
    })
    await FileSystem.writeAsStringAsync(LAST_RUN_FILE, String(now))
  } catch (err) {
    if (__DEV__) console.warn('[retention] No se pudo guardar la última corrida', err)
  }
}

/**
 * Reemplaza las URIs locales de las fotos por su `file_url` remoto. Así, al purgar los archivos, la
 * auditoría no queda apuntando a `file://` que ya no existen (editarla offline las volvería a
 * registrar como fotos sin subir y la dejaría `failed`).
 */
function withRemotePhotoUrls(
  answers: Record<string, SubmissionAnswer>,
  photos: readonly PhotoUpload[],
): Record<string, SubmissionAnswer> {
  const remoteByLocal = new Map(
    photos.filter(p => p.status === 'uploaded' && p.remoteUrl).map(p => [p.localUri, p.remoteUrl]),
  )
  const out: Record<string, SubmissionAnswer> = {}

  for (const [stepId, ans] of Object.entries(answers)) {
    if (!ans || ans.type !== 'Form') {
      out[stepId] = ans
      continue
    }
    const values: Record<string, unknown> = { ...(ans.values ?? {}) }
    for (const key of PHOTO_FIELD_KEYS) {
      const list = values[key]
      if (!Array.isArray(list)) continue
      values[key] = list.map(p => {
        const remote = remoteByLocal.get(photoUriOf(p))
        return remote ? withPhotoUri(p, remote) : p
      })
    }
    out[stepId] = { ...ans, values } as typeof ans
  }
  return out
}

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/**
 * Limpieza local de fotos de auditorías V2 ya confirmadas por el backend.
 *
 * - Sólo toca auditorías `submitted` sin items en el outbox (una edición pendiente la excluye) y
 *   cuyas fotos estén todas `uploaded`. Nunca borra fotos `pending` / `uploading` / `failed`, ni de
 *   borradores.
 * - Pasados 7 días borra fotos + filas + la submission. Con poco espacio libre (< ~500 MB) libera
 *   antes las fotos (mínimo 24 h), de la más vieja a la más nueva, y se detiene al recuperar espacio.
 * - Corre como máximo una vez por día (una por hora con poco espacio), en lotes y sin lanzar:
 *   un fallo se registra y la próxima corrida lo reintenta.
 *
 * Devuelve cuántas auditorías limpió.
 */
export async function runPhotoRetention(opts?: { force?: boolean; now?: number }): Promise<number> {
  if (running) return 0
  running = true

  try {
    const now = opts?.now ?? Date.now()
    const free = await getFreeDiskBytes()
    const pressure = free !== null && free < LOW_DISK_BYTES

    if (!opts?.force && !isRetentionDue(await readLastRun(), now, pressure)) return 0

    const submitted = await sqliteSubmissionRepo.listSubmittedForRetention()
    let cleaned = 0
    let failures = 0
    let underPressure = pressure

    for (let i = 0; i < submitted.length; i++) {
      const row = submitted[i]
      if (!row) continue

      try {
        const photos = await sqlitePhotoUploadRepo.listBySubmission(row.id)
        const candidate: RetentionCandidate = {
          submissionId: row.id,
          confirmedAt: row.confirmedAt,
          hasPhotos: photos.length > 0,
          allUploaded: photos.every(p => p.status === 'uploaded'),
        }

        const action = decideRetention(candidate, now, underPressure)
        if (action) {
          if (action === 'purge-photos') {
            const snapshot = await sqliteSubmissionRepo.getById(row.id)
            if (snapshot) {
              await sqliteSubmissionRepo.replaceAnswers(
                row.id,
                withRemotePhotoUrls(snapshot.answers, photos),
              )
            }
          }
          await discardPhotoGroup(row.id)
          await sqlitePhotoUploadRepo.deleteBySubmission(row.id)
          if (action === 'purge-all') await sqliteSubmissionRepo.delete(row.id)
          cleaned += 1

          // Con presión se libera de a una (la más vieja primero) hasta recuperar el espacio
          if (underPressure) {
            const left = await getFreeDiskBytes()
            if (left !== null && left >= LOW_DISK_BYTES) underPressure = false
          }
        }
      } catch (err) {
        failures += 1
        if (__DEV__) console.warn('[retention] falló la limpieza de', row.id, err)
      }

      if ((i + 1) % BATCH_SIZE === 0) await yieldToUi()
    }

    // Si algo falló no se marca la corrida: la próxima apertura vuelve a intentarlo
    if (failures === 0) await writeLastRun(now)
    if (__DEV__ && cleaned > 0) console.log('[retention] auditorías limpiadas:', cleaned)
    return cleaned
  } catch (err) {
    if (__DEV__) console.warn('[retention] runPhotoRetention falló', err)
    return 0
  } finally {
    running = false
  }
}
