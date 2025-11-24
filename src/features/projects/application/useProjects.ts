import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, ProjectStatus } from '@entities/project/model'
import type { ListProjectsParams } from '@entities/project/ports'
import { createOfflineFirstProjectRepo } from '@features/projects/data/project.repo.offline'

/**
 * Opciones de listado (dominio)
 */
export type UseProjectsOptions = {
  status?: ProjectStatus
  search?: string
  limit?: number
  sortBy?: 'created_at' | 'updated_at' | 'name'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Hook para consumir proyectos desde la API con paginación por cursor.
 * - Soporta cancelación (AbortController) para evitar race conditions.
 */
export function useProjects(opts: UseProjectsOptions = {}) {
  const repoRef = useRef(createOfflineFirstProjectRepo())
  const [items, setItems] = useState<Project[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const [loading, setLoading] = useState<boolean>(true)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const baseParams = useMemo<ListProjectsParams>(() => {
    return {
      status: opts.status,
      search: opts.search,
      limit: opts.limit,
      sortBy: opts.sortBy,
      sortOrder: opts.sortOrder,
    }
  }, [opts.status, opts.search, opts.limit, opts.sortBy, opts.sortOrder])

  const fetchPage = useCallback(
    async ({ reset }: { reset: boolean }) => {
      // Cancelar request previo (si lo hubiera)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const params: ListProjectsParams = {
        ...baseParams,
        cursor: reset ? undefined : cursor,
      }

      try {
        setError(null)
        if (reset) {
          setRefreshing(true)
        } else if (cursor) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }

        const page = await repoRef.current.list({
          ...params,
          signal: controller.signal,
        })

        setCursor(page.nextCursor)
        setItems(prev => (reset ? page.items : prev.concat(page.items)))
      } catch (e: any) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e : new Error('Unknown error'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [baseParams, cursor],
  )

  // Primera carga + cambios de filtros/orden → resetear y recargar
  useEffect(() => {
    fetchPage({ reset: true })
    // cleanup: abortar si el componente se desmonta
    return () => abortRef.current?.abort()
  }, [fetchPage])

  const refresh = useCallback(() => fetchPage({ reset: true }), [fetchPage])

  const loadMore = useCallback(() => {
    if (!cursor) return
    fetchPage({ reset: false })
  }, [cursor, fetchPage])

  const hasNextPage = Boolean(cursor)

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    error,

    hasNextPage,
    refresh,
    loadMore,
  }
}

/**
 * Hook para obtener un proyecto por ID.
 */
export function useProjectById(projectId: string | null | undefined) {
  const repoRef = useRef(createOfflineFirstProjectRepo())

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!projectId) {
      setProject(null)
      setLoading(false)
      setError(null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const p = await repoRef.current.getById(projectId, { signal: controller.signal })
        setProject(p)
      } catch (e: any) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e : new Error('Unknown error'))
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [projectId])

  return { project, loading, error }
}
