export type ProjectId = string
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'

export interface ProjectUserSummary {
  id: string
  name: string
}

export interface ProjectFacilitySummary {
  id: string
  name: string
}

export interface Project {
  id: ProjectId

  // Código interno opcional (si el backend lo expone)
  code?: string | null | undefined

  name?: string | null | undefined
  description?: string | null | undefined
  status?: ProjectStatus | undefined

  // Resúmenes ricos (cuando vienen del API de proyectos)
  users?: ProjectUserSummary[] | undefined
  facilities?: ProjectFacilitySummary[] | undefined

  // Identificadores planos (cuando sólo tenemos cache local)
  userIds?: string[] | undefined
  facilityIds?: string[] | undefined

  createdAt?: string | undefined
  updatedAt?: string | undefined
  createdBy?: string | undefined
}

export interface ProjectsPage {
  items: Project[]
  limit: number
  nextCursor?: string | undefined
}

/**
 * Factory de dominio para Project.
 *
 * Centraliza defaults y nos permite evolucionar el modelo
 * sin tocar todos los callers.
 */
export function createProject(params: {
  id: ProjectId
  code?: string | null | undefined
  name?: string | null | undefined
  description?: string | null | undefined
  status?: ProjectStatus | undefined
  users?: ProjectUserSummary[] | undefined
  facilities?: ProjectFacilitySummary[] | undefined
  userIds?: string[] | undefined
  facilityIds?: string[] | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
  createdBy?: string | undefined
}): Project {
  return {
    id: params.id,
    code: params.code ?? null,
    name: params.name ?? null,
    description: params.description ?? null,
    status: params.status,
    // Copias defensivas para no compartir referencias
    users: params.users ? [...params.users] : undefined,
    facilities: params.facilities ? [...params.facilities] : undefined,
    userIds: params.userIds ? [...params.userIds] : undefined,
    facilityIds: params.facilityIds ? [...params.facilityIds] : undefined,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    createdBy: params.createdBy,
  }
}
