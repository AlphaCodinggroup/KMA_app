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
  name?: string
  description?: string | null
  status?: ProjectStatus
  users?: ProjectUserSummary[]
  facilities?: ProjectFacilitySummary[]
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}
export interface ProjectsPage {
  items: Project[]
  limit: number
  nextCursor?: string
}
