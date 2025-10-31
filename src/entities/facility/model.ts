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
  projectId: ProjectId
  name: string
  address?: string
  city?: string
  geo?: GeoPoint
  notes?: string
  status: FacilityStatus
  userIds: string[]
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

/** Página/colección paginada en dominio (útil para repos). */
export interface FacilitiesPage {
  items: Facility[]
  limit?: number
  nextCursor?: string
}
