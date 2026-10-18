type Listener = () => void

const listeners = new Set<Listener>()
let scheduled: ReturnType<typeof setTimeout> | null = null

/** Retardo para agrupar ráfagas (p. ej. borrar N filas) en una sola notificación. */
const COALESCE_MS = 60

/** Suscripción a cambios en el estado de subida de fotos (tabla `photo_uploads`). */
export function subscribePhotoSync(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Avisa que cambió el estado de alguna foto. Se agrupan las notificaciones cercanas: la UI se
 * refresca una vez, bien dentro del segundo desde el evento.
 */
export function notifyPhotoSyncChanged(): void {
  if (scheduled) return
  scheduled = setTimeout(() => {
    scheduled = null
    listeners.forEach(listener => {
      try {
        listener()
      } catch (err) {
        if (__DEV__) console.warn('[photoSyncSignal] listener error', err)
      }
    })
  }, COALESCE_MS)
}
