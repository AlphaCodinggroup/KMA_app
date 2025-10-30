// Hooks de aplicación
export { useProjects, useProjectById } from './application/useProjects'
export type { UseProjectsOptions } from './application/useProjects'

// Repo HTTP (por si se necesita inyectar o testear)
export { createHttpProjectRepo } from './data/project.repo.http'

// (Opcional) Re-exports útiles de dominio
export type { Project, ProjectStatus, ProjectsPage } from '@entities/project/model'
