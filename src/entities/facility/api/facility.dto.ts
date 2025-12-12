import { z } from 'zod'

/**
 * DTOs y validaciones de la API de Facilities
 * ----------------------------------------------------
 * - Listar todas las facilities de un proyecto:
 *   GET /api/projects/{project_id}/facilities
 *   Respuesta: { status: "success", data: { facilities: [...], limit?, next_cursor? } }
 * - Detalle por ID:
 *   GET /api/projects/{project_id}/facilities/{facility_id}
 *
 * Notas:
 * - status permitido: "ACTIVE" | "ARCHIVED"
 * - user_ids puede venir como [] o null según endpoint
 * - address, city, geo, notes son opcionales
 */

export const FacilityStatusDtoSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export type FacilityStatusDTO = z.infer<typeof FacilityStatusDtoSchema>

export const FacilityGeoDtoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
})
export type FacilityGeoDTO = z.infer<typeof FacilityGeoDtoSchema>

/** Ítem de facility según el backend (snake_case) */
export const FacilityItemDtoSchema = z.object({
  facility_id: z.string(),
  project_id: z.string().optional(),
  name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  geo: FacilityGeoDtoSchema.optional(),
  notes: z.string().optional(),
  status: FacilityStatusDtoSchema.optional(),
  user_ids: z.array(z.string()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
})
export type FacilityItemDTO = z.infer<typeof FacilityItemDtoSchema>

/** Respuesta de listado de facilities */
export const FacilitiesListResponseDtoSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    facilities: z.array(FacilityItemDtoSchema),
    limit: z.number().optional(),
    next_cursor: z.string().optional(),
  }),
})
export type FacilitiesListResponseDTO = z.infer<typeof FacilitiesListResponseDtoSchema>

/** Respuesta de detalle de facility */
export const FacilityDetailResponseDtoSchema = z.object({
  status: z.literal('success'),
  data: FacilityItemDtoSchema,
})
export type FacilityDetailResponseDTO = z.infer<typeof FacilityDetailResponseDtoSchema>

/** Estructura de error común */
export const FacilityErrorResponseDtoSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
})
export type FacilityErrorResponseDTO = z.infer<typeof FacilityErrorResponseDtoSchema>
