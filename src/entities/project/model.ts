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
  code?: string | null

  name?: string | null
  description?: string | null
  status?: ProjectStatus

  // Resúmenes ricos (cuando vienen del API de proyectos)
  users?: ProjectUserSummary[]
  facilities?: ProjectFacilitySummary[]

  // Identificadores planos (cuando sólo tenemos cache local)
  userIds?: string[]
  facilityIds?: string[]

  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

export interface ProjectsPage {
  items: Project[]
  limit: number
  nextCursor?: string
}

/**
 * Factory de dominio para Project.
 *
 * Centraliza defaults y nos permite evolucionar el modelo
 * sin tocar todos los callers.
 */
export function createProject(params: {
  id: ProjectId
  code?: string | null
  name?: string | null
  description?: string | null
  status?: ProjectStatus
  users?: ProjectUserSummary[]
  facilities?: ProjectFacilitySummary[]
  userIds?: string[]
  facilityIds?: string[]
  createdAt?: string
  updatedAt?: string
  createdBy?: string
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
