import type { FacilitiesPage, Facility, ProjectId } from '@entities/facility/model'
import type { FacilityRepo, ListFacilitiesParams } from '@entities/facility/ports'
import {
  FacilitiesListResponseDtoSchema,
  FacilityDetailResponseDtoSchema,
} from '@entities/facility/api/facility.dto'
import {
  mapFacilitiesListResponseToDomain,
  mapFacilityDtoToDomain,
} from '@entities/facility/lib/mappers'
import { http } from '@core/http/http'

/**
 * Repositorio HTTP para Facilities
 * ----------------------------------------------------
 * - Usa la instancia axios con interceptores (auth, retry/backoff, idempotencia).
 * - Valida las respuestas con Zod (DTOs) y mapea a dominio.
 */

export class HttpFacilityRepo implements FacilityRepo {
  constructor(private readonly client = http) {}

  async listByProject(
    projectId: ProjectId,
    params?: ListFacilitiesParams,
  ): Promise<FacilitiesPage> {
    const { data } = await this.client.get(`/api/projects/${projectId}/facilities`, {
      params: {
        limit: params?.limit,
        cursor: params?.cursor,
        status: params?.status, // 'ACTIVE' | 'ARCHIVED'
        search: params?.search,
      },
    })

    const parsed = FacilitiesListResponseDtoSchema.safeParse(data)
    if (!parsed.success) {
      const reason = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
      throw new Error(`Invalid facilities list payload: ${reason}`)
    }

    return mapFacilitiesListResponseToDomain(parsed.data)
  }

  async getById(projectId: ProjectId, facilityId: string): Promise<Facility> {
    const { data } = await this.client.get(`/api/projects/${projectId}/facilities/${facilityId}`)

    const parsed = FacilityDetailResponseDtoSchema.safeParse(data)
    if (!parsed.success) {
      const reason = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
      throw new Error(`Invalid facility detail payload: ${reason}`)
    }

    return mapFacilityDtoToDomain(parsed.data.data)
  }
}

/** Factory simple para mantener consistencia con otras features */
export function createHttpFacilityRepo(client = http): FacilityRepo {
  return new HttpFacilityRepo(client)
}
