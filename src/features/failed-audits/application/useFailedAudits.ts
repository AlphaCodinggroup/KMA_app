import { useCallback, useState, useSyncExternalStore } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { subscribeFailedAudits } from '@processes/sync/failedAuditsSignal'
import { listFailedAudits, retryFailedAudit, type FailedAudit } from './usecases'

/**
 * Estado compartido entre todos los consumidores (banner del Selector y sección de Profile):
 * una sola query por refresh, aunque haya varios componentes montados.
 */
let current: FailedAudit[] = []
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
let signalUnsubscribe: (() => void) | null = null

function emit() {
  listeners.forEach(l => l())
}

/** Evita re-render si la lista no cambió. */
function sameItems(a: FailedAudit[], b: FailedAudit[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.submissionId === b[i]?.submissionId &&
        x.title === b[i]?.title &&
        x.message === b[i]?.message,
    )
  )
}

function refreshShared(): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const next = await listFailedAudits()
      if (!sameItems(current, next)) {
        current = next
        emit()
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[useFailedAudits] refresh failed', err)
      }
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // La señal global se escucha una sola vez mientras haya algún consumidor
  if (!signalUnsubscribe) signalUnsubscribe = subscribeFailedAudits(() => void refreshShared())
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      signalUnsubscribe?.()
      signalUnsubscribe = null
      // Sin consumidores no se retiene la lista: otro usuario no debe ver la del anterior
      current = []
    }
  }
}

const getSnapshot = () => current

export function useFailedAudits() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [retrying, setRetrying] = useState(false)

  useFocusEffect(
    useCallback(() => {
      void refreshShared()
    }, []),
  )

  const retry = useCallback(async (submissionId: string) => {
    setRetrying(true)
    try {
      await retryFailedAudit(submissionId)
    } finally {
      setRetrying(false)
    }
  }, [])

  const retryAll = useCallback(async () => {
    setRetrying(true)
    try {
      for (const item of current) {
        await retryFailedAudit(item.submissionId)
      }
    } finally {
      setRetrying(false)
    }
  }, [])

  return { items, retrying, retry, retryAll }
}
