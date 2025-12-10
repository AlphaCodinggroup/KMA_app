import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import type { Flow } from '@entities/flow/model'
import { loadAllFlowsWithSteps } from './usecases'

export type UseFlowsResult = {
  items: Flow[]
  loading: boolean
  refreshing: boolean
  error: Error | null
  refresh: () => void
}

/**
 * Cache en memoria a nivel módulo.
 *
 * - Comparte los flows entre montajes sucesivos del hook en la MISMA sesión.
 * - No reemplaza la cache SQLite ni la precarga de imágenes:
 *   sólo mejora la UX (no mostrar skeleton si ya tenemos data).
 */
let flowsCache: Flow[] = []

/**
 * Hook de aplicación para cargar los flows completos (incluye steps),
 * usando el FlowRepo offline-first:
 *
 * - Online: va a la API y sincroniza SQLite (catálogo + steps).
 * - Offline / error de red: intenta reconstruir desde la cache local.
 *
 * Además:
 * - Expone estados de loading / refreshing.
 * - Mantiene los items actuales ante error (no borra la lista).
 * - Maneja errores con Alert.
 * - Usa una cache en memoria para UX tipo "stale-while-revalidate":
 *   si ya hay flowsCache, los muestra al instante y refeshea en segundo plano.
 */
export const useFlows = (): UseFlowsResult => {
  const [items, setItems] = useState<Flow[]>(() => flowsCache)
  const [loading, setLoading] = useState<boolean>(() => flowsCache.length === 0)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // Evitamos setState después de unmount
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const doFetch = useCallback(async (opts?: { reset?: boolean }) => {
    const reset = opts?.reset ?? false

    if (!isMountedRef.current) return

    const hasCache = flowsCache.length > 0

    if (reset) {
      setRefreshing(true)
    } else if (!hasCache) {
      // Sólo mostramos loading "duro" cuando no hay datos cacheados.
      setLoading(true)
    }

    try {
      setError(null)

      const full = await loadAllFlowsWithSteps()
      if (!isMountedRef.current) return

      // Actualizamos cache en memoria + estado local
      flowsCache = full
      setItems(full)
    } catch (e) {
      if (!isMountedRef.current) return

      const err = e instanceof Error ? e : new Error('Failed to load flows')
      setError(err)

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useFlows] Error loading flows', err)
      }

      // Importante: NO vaciamos items.
      Alert.alert(
        'Error',
        'There was a problem loading the flows. If you are offline, please try again after reconnecting.',
      )
    } finally {
      if (!isMountedRef.current) return

      if (reset) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  // Carga inicial al montar el hook
  useEffect(() => {
    void doFetch({ reset: false })
  }, [doFetch])

  // API pública para pull-to-refresh / reintentos
  const refresh = useCallback(() => {
    void doFetch({ reset: true })
  }, [doFetch])

  return {
    items,
    loading,
    refreshing,
    error,
    refresh,
  }
}
