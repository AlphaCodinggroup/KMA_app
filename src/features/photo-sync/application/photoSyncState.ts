import type { PhotoUpload } from '@entities/photo/model'
import type { PhotoBadgeStatus } from '@shared/ui/photo/PhotoSyncBadge'

/** Estado visible de una foto, según su fila y si hay red. */
export function badgeOf(photo: PhotoUpload, online: boolean): PhotoBadgeStatus {
  switch (photo.status) {
    case 'uploaded':
      return 'uploaded'
    case 'uploading':
      return 'uploading'
    case 'failed':
      return 'failed'
    default:
      return online ? 'waiting' : 'offline'
  }
}

export type PhotoCounts = {
  total: number
  uploaded: number
  uploading: number
  /** `pending` (en cola, con o sin red). */
  waiting: number
  failed: number
  /** Todo lo que falta respaldar: uploading + waiting + failed. */
  unsynced: number
}

export function countPhotos(photos: readonly PhotoUpload[]): PhotoCounts {
  const counts: PhotoCounts = {
    total: photos.length,
    uploaded: 0,
    uploading: 0,
    waiting: 0,
    failed: 0,
    unsynced: 0,
  }
  for (const p of photos) {
    if (p.status === 'uploaded') counts.uploaded++
    else if (p.status === 'uploading') counts.uploading++
    else if (p.status === 'failed') counts.failed++
    else counts.waiting++
  }
  counts.unsynced = counts.total - counts.uploaded
  return counts
}

/** El peor estado de un grupo de fotos (para un resumen de una sola fila). */
export function worstBadge(statuses: readonly PhotoBadgeStatus[]): PhotoBadgeStatus {
  const order: PhotoBadgeStatus[] = ['failed', 'offline', 'waiting', 'uploading', 'uploaded']
  return order.find(s => statuses.includes(s)) ?? 'uploaded'
}
