import type {
  FacilityItemDTO,
  FacilitiesListResponseDTO,
} from '@entities/facility/api/facility.dto'
import type { Facility, FacilityStatus } from '@entities/facility/model'

/**
 * Mappers de Facilities
 * ----------------------------------------------------
 * - Normaliza snake_case (DTO) → camelCase (dominio)
 * - Asegura defaults seguros (status, userIds)
 */

/**
 * Mapper: DTO (snake_case) -> Dominio (camelCase)
 * - user_ids puede venir como [] o null; normalizamos a [].
 * - status puede no venir en algunas respuestas; fallback 'ACTIVE'.
 */
export function mapFacilityDtoToDomain(dto: FacilityItemDTO): Facility {
  return {
    id: dto.facility_id,
    projectId: dto.project_id ?? '',
    name: dto.name ?? '',
    address: dto.address ?? '',
    city: dto.city ?? '',
    geo: { lat: dto.geo?.lat ?? 0, lng: dto.geo?.lng ?? 0 },
    notes: dto.notes ?? '',
    status: (dto.status ?? 'ACTIVE') as FacilityStatus,
    userIds: Array.isArray(dto.user_ids) ? dto.user_ids : [],
    createdAt: dto.created_at ?? '',
    updatedAt: dto.updated_at ?? '',
    createdBy: dto.created_by ?? '',
    updatedBy: dto.updated_by ?? '',
  }
}

/**
 * Mapper para la respuesta paginada de listado.
 */
export function mapFacilitiesListResponseToDomain(resp: FacilitiesListResponseDTO): {
  items: Facility[]
  limit?: number
  nextCursor?: string
} {
  const facilities = resp.data.facilities.map(mapFacilityDtoToDomain)
  return {
    items: facilities,
    limit: resp.data.limit ?? 0,
    nextCursor: resp.data.next_cursor ?? '',
  }
}
