// Casos de uso y hooks
export {
  useFacilitiesByProject,
  listFacilitiesByProjectUseCase,
  setFacilityRepo,
} from './application/usecases'

// Tipos de filtros (query params) del puerto
export type { ListFacilitiesParams } from '@entities/facility/ports'

// Dominio
export type { Facility, FacilitiesPage, FacilityStatus, ProjectId } from '@entities/facility/model'

// Factory del repo HTTP
export { createHttpFacilityRepo } from './data/facility.repo.http'
