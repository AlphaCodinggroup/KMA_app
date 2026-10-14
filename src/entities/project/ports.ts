import type { Project, ProjectId, ProjectStatus, ProjectsPage } from './model'

/**
 * Parámetros de búsqueda/paginación para listar proyectos.
 * - status: 'active' | 'archived'
 * - search: texto libre
 * - limit: tamaño de página
 * - cursor: token de paginación
 * - sortBy: campo de orden (en API se usa snake_case, aquí lo
 *   expresamos tal cual la API para evitar ambigüedad)
 * - sortOrder: 'asc' | 'desc'
 */
export type ListProjectsParams = {
  status?: ProjectStatus | undefined
  search?: string | undefined
  limit?: number | undefined
  cursor?: string | undefined
  sortBy?: 'created_at' | 'updated_at' | 'name' | undefined
  sortOrder?: 'asc' | 'desc' | undefined
}

/**
 * Contrato del repositorio de Projects.
 */
export interface ProjectRepo {
  /** Lista proyectos con filtros/paginación por cursor. */
  list(params?: ListProjectsParams & { signal?: AbortSignal }): Promise<ProjectsPage>

  /** Obtiene un proyecto por su ID. Lanza si no existe. */
  getById(id: ProjectId, opts?: { signal?: AbortSignal }): Promise<Project>
}

/**
 * Alias de interfaz (para DI si se usa) y factory mínima.
 */
export type IProjectRepo = ProjectRepo

export const ProjectRepoNotImplemented: ProjectRepo = {
  async list() {
    throw new Error('ProjectRepo.list no implementado')
  },
  async getById() {
    throw new Error('ProjectRepo.getById no implementado')
  },
}
