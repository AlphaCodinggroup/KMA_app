import { useSyncExternalStore } from 'react'
import type { PhotoUpload } from '@entities/photo/model'
import { sqlitePhotoUploadRepo } from '@core/repos/sqlitePhotoUploadRepo'
import { getCurrentUserId } from '@shared/session/session'
import { subscribePhotoSync } from '@shared/lib/photoSyncSignal'

/**
 * Estado compartido de las fotos de las auditorías V2 del usuario. Una sola query por refresh
 * aunque haya varios consumidores (campo de foto, sección del runner, indicador de Profile).
 * Sin consumidores no se retiene nada: otro usuario no ve la lista del anterior.
 */
let current: PhotoUpload[] = []
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
let signalUnsubscribe: (() => void) | null = null

function emit() {
  listeners.forEach(l => l())
}

/** Evita re-render si nada visible cambió. */
function sameItems(a: PhotoUpload[], b: PhotoUpload[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) => x.id === b[i]?.id && x.status === b[i]?.status && x.updatedAt === b[i]?.updatedAt,
    )
  )
}

/** Llegó una señal mientras corría una query: hay que volver a leer (la lectura en curso puede ser vieja). */
let dirty = false

export function refreshPhotoSync(): Promise<void> {
  if (inflight) {
    dirty = true
    return inflight
  }
  inflight = (async () => {
    try {
      do {
        dirty = false
        const userId = getCurrentUserId()
        const next = userId ? await sqlitePhotoUploadRepo.listV2ForUser(userId) : []
        // Sin consumidores no se retiene nada (otro usuario no debe ver la lista del anterior)
        if (listeners.size === 0) break
        if (!sameItems(current, next)) {
          current = next
          emit()
        }
      } while (dirty)
    } catch (err) {
      if (__DEV__) console.warn('[photoSyncStore] refresh failed', err)
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!signalUnsubscribe) {
    signalUnsubscribe = subscribePhotoSync(() => void refreshPhotoSync())
    void refreshPhotoSync()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      signalUnsubscribe?.()
      signalUnsubscribe = null
      current = []
    }
  }
}

const getSnapshot = () => current

export function usePhotoRows(): PhotoUpload[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
