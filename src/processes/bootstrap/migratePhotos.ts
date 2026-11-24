import * as FileSystem from 'expo-file-system'

import { PHOTOS_ROOT, isPersistedPhotoUri } from '@features/camera'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import type { SubmissionSnapshot } from '@entities/submission/ports'
import {
  PHOTO_FIELD_KEYS,
  photoUriOf,
  withPhotoUri,
  type PhotoValue,
} from '@entities/submission/lib/photos'

/**
 * Fotos de la 1.0.8 que quedaron en caché (`Library/Caches`, que iOS puede purgar): las copia a
 * `documentDirectory/kma/photos/<submissionId>/` y reescribe el payload. Sólo toca submissions
 * `draft` / `queued`. Si una foto ya no existe, la submission queda `failed` con `photo_missing`
 * (visible en la UI de fallidas). Idempotente: las URIs ya persistidas se saltean.
 */
export async function migrateCachedPhotos(): Promise<void> {
  if (!PHOTOS_ROOT) return

  const pending = [
    ...(await sqliteSubmissionRepo.listPendingWithFiles('draft')),
    ...(await sqliteSubmissionRepo.listPendingWithFiles('queued')),
  ]

  for (const snap of pending) {
    try {
      await migrateSubmission(snap)
    } catch (err) {
      if (__DEV__) console.warn('[bootstrap] migrateCachedPhotos falló', snap.id, err)
    }
  }
}

async function migrateSubmission(snap: SubmissionSnapshot): Promise<void> {
  let changed = false
  let missing = 0
  const answers = { ...snap.answers }

  for (const [stepId, ans] of Object.entries(answers)) {
    if (!ans || ans.type !== 'Form') continue
    const values: Record<string, unknown> = { ...(ans.values ?? {}) }

    for (const key of PHOTO_FIELD_KEYS) {
      const list = values[key]
      if (!Array.isArray(list)) continue

      const next: PhotoValue[] = []
      for (const p of list as PhotoValue[]) {
        const uri = photoUriOf(p)
        if (!uri || !uri.startsWith('file://') || isPersistedPhotoUri(uri)) {
          next.push(p)
          continue
        }

        const info = await FileSystem.getInfoAsync(uri)
        if (!info.exists) {
          missing += 1
          next.push(p)
          continue
        }

        const dir = `${PHOTOS_ROOT}/${snap.id}`
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
        const name = uri.split('/').pop() || `${Date.now().toString(36)}.jpg`
        const dest = `${dir}/${name}`
        await FileSystem.copyAsync({ from: uri, to: dest })
        next.push(withPhotoUri(p, dest))
        changed = true
      }
      values[key] = next
    }

    answers[stepId] = { ...ans, values } as typeof ans
  }

  if (changed) {
    await sqliteSubmissionRepo.saveDraft({
      id: snap.id,
      draft: { flowId: snap.flowId, title: snap.title, createdAt: snap.createdAt, answers },
      ...(snap.projectId ? { projectId: snap.projectId } : {}),
      ...(snap.facilityId ? { facilityId: snap.facilityId } : {}),
      ...(snap.version ? { version: snap.version } : {}),
    })
  }

  if (missing > 0 && snap.status === 'queued') {
    await sqliteSubmissionRepo.markStatus(
      snap.id,
      'failed',
      JSON.stringify({
        status: null,
        error: 'photo_missing',
        message: `${missing} photo(s) are no longer on this device.`,
      }),
    )
    // El item de outbox también pasa a `failed`: sin la foto no hay nada que reintentar
    await sqliteOutboxRepo.markFailedBySubmissionId(snap.id, 'photo_missing')
  }
}
