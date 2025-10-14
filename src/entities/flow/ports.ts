import type { Flow, FlowSummary } from './model'

/**
 * Parámetros de consulta para futuras extensiones (paginación, filtros, etc.).
 * Por ahora no los usa la API, pero dejamos el contrato preparado.
 */
export type FlowsQuery = {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

/**
 * Contrato del repositorio de Flows (dominio).
 * Tendremos implementaciones concretas:
 *  - HTTP: lee de /api/v1/flows (online)
 *  - SQLite: cache/persistencia
 */
export interface FlowRepo {
  /**
   * Retorna todos los flows completos (incluye steps).
   * Ideal para el Selector o para precargar caché.
   */
  getAll(query?: FlowsQuery): Promise<Flow[]>

  /**
   * Retorna un flow específico por id (completo con steps).
   * La impl HTTP puede resolverlo filtrando el getAll si no hay endpoint /flows/:id.
   */
  getById(id: string, opts?: { signal?: AbortSignal }): Promise<Flow | null>

  /**
   * Retorna solo resúmenes (ligeros) para listados.
   * Si la API no ofrece resúmenes, se derivan de getAll().
   */
  getSummaries(query?: FlowsQuery): Promise<FlowSummary[]>
}

/**
 * Token/tipo de inyección.
 */
export type FlowRepoFactory = () => FlowRepo
