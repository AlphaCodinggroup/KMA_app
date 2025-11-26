import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FacilitiesPage, Facility, ProjectId } from '@entities/facility/model'
import type { FacilityRepo, ListFacilitiesParams } from '@entities/facility/ports'
import { createOfflineFirstFacilityRepo } from '@features/facility/data/facility.repo.offline'

/**
 * Repo offline-first por defecto (HTTP + SQLite).
 */
let facilityRepoSingleton: FacilityRepo | null = null

function getFacilityRepo(): FacilityRepo {
  if (!facilityRepoSingleton) facilityRepoSingleton = createOfflineFirstFacilityRepo()
  return facilityRepoSingleton
}

/** Permite inyectar un repo custom (tests, historias, etc). */
export function setFacilityRepo(repo: FacilityRepo | null) {
  facilityRepoSingleton = repo
}

/** UC: listar facilities por proyecto. */
export async function listFacilitiesByProjectUseCase(
  projectId: ProjectId,
  params?: ListFacilitiesParams,
  repo: FacilityRepo = getFacilityRepo(),
): Promise<FacilitiesPage> {
  if (!projectId) throw new Error('projectId requerido')
  return repo.listByProject(projectId, params)
}

/**
 * Hook: usa el UC anterior, maneja estados, refresh y paginación por cursor.
 */
export function useFacilitiesByProject(
  projectId: ProjectId | undefined,
  params?: ListFacilitiesParams,
  repo?: FacilityRepo,
) {
  const effectiveRepo = repo ?? getFacilityRepo()

  const [items, setItems] = useState<Facility[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<unknown>(null)

  // Clave estable para detectar cambios de filtros sin causar bucles
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params])

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const page = await listFacilitiesByProjectUseCase(projectId, params, effectiveRepo)
      if (!mountedRef.current) return
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
    } finally {
      if (!mountedRef.current) return
      setLoading(false)
    }
  }, [projectId, params, effectiveRepo])

  const refresh = useCallback(async () => {
    if (!projectId) return
    setRefreshing(true)
    setError(null)
    try {
      const page = await listFacilitiesByProjectUseCase(projectId, params, effectiveRepo)
      if (!mountedRef.current) return
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
    } finally {
      if (!mountedRef.current) return
      setRefreshing(false)
    }
  }, [projectId, params, effectiveRepo])

  const loadMore = useCallback(async () => {
    if (!projectId || !nextCursor) return
    setLoading(true)
    setError(null)
    try {
      const page = await listFacilitiesByProjectUseCase(
        projectId,
        { ...(params ?? {}), cursor: nextCursor },
        effectiveRepo,
      )
      if (!mountedRef.current) return
      setItems(prev => prev.concat(page.items))
      setNextCursor(page.nextCursor)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
    } finally {
      if (!mountedRef.current) return
      setLoading(false)
    }
  }, [projectId, nextCursor, params, effectiveRepo])

  // Efecto inicial / cuando cambian projectId o filtros
  useEffect(() => {
    // resetea antes de cargar con nuevos filtros
    setItems([])
    setNextCursor(undefined)
    setError(null)
    if (projectId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, paramsKey])

  return {
    items,
    loading,
    refreshing,
    error,
    hasNextPage: Boolean(nextCursor),
    loadMore,
    refresh,
  }
}
