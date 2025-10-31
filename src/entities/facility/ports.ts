import type { FacilitiesPage, Facility, FacilityStatus, ProjectId } from '@entities/facility/model'

/**
 * Parámetros de consulta para listar facilities de un proyecto.
 * - limit: tamaño de página (default backend = 20)
 * - cursor: paginación basada en cursor
 * - status: 'ACTIVE' | 'ARCHIVED'
 * - search: texto para filtrar por nombre
 */
export interface ListFacilitiesParams {
  limit?: number
  cursor?: string
  status?: FacilityStatus
  search?: string
}

/**
 * Puerto del repositorio de Facilities.
 */
export interface FacilityRepo {
  /**
   * Lista las facilities de un proyecto, con paginación y filtros.
   */
  listByProject(projectId: ProjectId, params?: ListFacilitiesParams): Promise<FacilitiesPage>

  /**
   * (Opcional / futuro) Obtener detalle por ID.
   */
  getById?(projectId: ProjectId, facilityId: string): Promise<Facility>
}
