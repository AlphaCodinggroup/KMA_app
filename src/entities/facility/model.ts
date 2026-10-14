/**
 * Dominio puro de Facilities.
 */

export type FacilityId = string
export type ProjectId = string
export type FacilityStatus = 'ACTIVE' | 'ARCHIVED'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface Facility {
  id: FacilityId
  projectId?: ProjectId | undefined
  name?: string | undefined
  address?: string | undefined
  city?: string | undefined
  geo?: GeoPoint | undefined
  notes?: string | undefined
  status?: FacilityStatus | undefined
  userIds?: string[] | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
  createdBy?: string | undefined
  updatedBy?: string | undefined
}

/** Página/colección paginada en dominio (útil para repos). */
export interface FacilitiesPage {
  items: Facility[]
  limit?: number | undefined
  nextCursor?: string | undefined
}
