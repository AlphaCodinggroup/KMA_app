import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { registerSubmissionPhotos } from '@features/flow-runner/application/photoUploads'

/**
 * Registra en `photo_uploads` las fotos locales de las submissions `draft` / `queued` que todavía no
 * tienen fila (capturadas antes de esta versión, o cuyo registro falló). Idempotente.
 * Corre después de `migrateCachedPhotos`, así que las URIs ya son las persistidas.
 */
export async function registerPendingPhotoUploads(): Promise<void> {
  const pending = [
    ...(await sqliteSubmissionRepo.listPendingWithFiles('draft')),
    ...(await sqliteSubmissionRepo.listPendingWithFiles('queued')),
  ]

  for (const snap of pending) {
    try {
      await registerSubmissionPhotos(snap)
    } catch (err) {
      if (__DEV__) console.warn('[bootstrap] registerPendingPhotoUploads falló', snap.id, err)
    }
  }
}
