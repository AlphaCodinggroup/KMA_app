import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import type { CompletedAudit } from '@entities/audit/model'
import { syncCompletedAudits } from '@processes/catalog-sync'
import { isOnlineOnce } from '@shared/lib/network'
import { listCompletedAudits } from './usecases'

/**
 * Completados de una facility. Al enfocar la pantalla muestra primero lo local (cache + outbox) y
 * después baja del backend y vuelve a leer; sin red queda lo local. Pull-to-refresh fuerza el sync.
 */
export function useCompletedAudits(facilityId: string | undefined) {
  const [items, setItems] = useState<CompletedAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const read = useCallback(async (): Promise<CompletedAudit[] | null> => {
    if (!facilityId) return []
    try {
      return await listCompletedAudits(facilityId)
    } catch (err) {
      if (__DEV__) console.warn('[useCompletedAudits] read failed', err)
      return null
    }
  }, [facilityId])

  useFocusEffect(
    useCallback(() => {
      let active = true
      // Otra facility: no se muestra lo de la anterior mientras se lee
      setItems([])
      setLoading(true)
      void (async () => {
        const local = await read()
        if (!active) return
        if (local) setItems(local)
        setLoading(false)

        if (!(await isOnlineOnce())) return
        await syncCompletedAudits()
        const synced = await read()
        if (active && synced) setItems(synced)
      })()
      return () => {
        active = false
      }
    }, [read]),
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await syncCompletedAudits({ force: true })
      const next = await read()
      if (next) setItems(next)
    } finally {
      setRefreshing(false)
    }
  }, [read])

  /** Relee lo local (cache + outbox) sin sincronizar con el backend. */
  const reload = useCallback(async () => {
    const next = await read()
    if (next) setItems(next)
  }, [read])

  return { items, loading, refreshing, refresh, reload }
}
