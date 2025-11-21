/**
 * Dominio de Projects
 * ----------------------------------------------------
 * - Tipos y helpers de negocio.
 * - El mapeo DTO
 */

export type ProjectId = string
export type UserId = string
export type FacilityId = string

export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: ProjectId
  code?: string | null
  name?: string | null
  description?: string | null
  status?: ProjectStatus
  userIds?: UserId[]
  facilityIds?: FacilityId[]
  createdAt?: string
  updatedAt?: string
  createdBy?: UserId
}

/** Página de resultados para listados paginados por cursor */
export interface ProjectsPage {
  items: Project[]
  nextCursor?: string
  limit?: number
}

/** Helpers de negocio mínimos */
export const isProjectActive = (p: Project): boolean => p.status === 'active'

/** Fábrica segura para normalizar arrays opcionales */
export function createProject(
  input: Omit<Project, 'userIds' | 'facilityIds'> & {
    userIds?: UserId[] | null
    facilityIds?: FacilityId[] | null
  },
): Project {
  return {
    ...input,
    userIds: input.userIds ?? [],
    facilityIds: input.facilityIds ?? [],
  }
}
