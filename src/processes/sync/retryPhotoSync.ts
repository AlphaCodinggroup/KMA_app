import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { sqlitePhotoUploadRepo } from '@core/repos/sqlitePhotoUploadRepo'
import { getCurrentUserId } from '@shared/session/session'
import { enqueuePhotoUploads } from '@features/flow-runner/application/photoUploads'
import { triggerOutboxSync } from './outboxTrigger'

/**
 * "Retry sync" de fotos: vuelve a `pending` las que fallaron, reinicia el backoff de los items de
 * la auditoría, reencola la subida de las que no estén `uploaded` y dispara el sync. Las fotos ya
 * subidas no se tocan ni se reenvían.
 *
 * Sin `submissionId` actúa sobre todas las auditorías V2 del usuario con fotos sin subir.
 */
export async function retryPhotoSync(submissionId?: string): Promise<void> {
  let targets: string[]

  if (submissionId) {
    targets = [submissionId]
  } else {
    const userId = getCurrentUserId()
    if (!userId) return
    const photos = await sqlitePhotoUploadRepo.listV2ForUser(userId)
    targets = Array.from(
      new Set(photos.filter(p => p.status !== 'uploaded').map(p => p.submissionId)),
    )
  }

  for (const id of targets) {
    await sqlitePhotoUploadRepo.requeueFailed(id)
    await sqliteOutboxRepo.requeueBySubmissionId(id)
    await enqueuePhotoUploads(id)
  }

  triggerOutboxSync()
}
