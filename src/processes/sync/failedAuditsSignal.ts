type Listener = () => void

const listeners = new Set<Listener>()

/** Suscripción a cambios en la lista de auditorías fallidas (alta, reintento). */
export function subscribeFailedAudits(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyFailedAuditsChanged(): void {
  listeners.forEach(listener => {
    try {
      listener()
    } catch (err) {
      if (__DEV__) {
        console.warn('[failedAuditsSignal] listener error', err)
      }
    }
  })
}
