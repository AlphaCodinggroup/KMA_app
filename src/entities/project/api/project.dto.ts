import { z } from 'zod'

/**
 * DTOs y validaciones de la API de Projects
 * ----------------------------------------------------
 * - La UI/domino se mapea luego a camelCase en mappers.
 * - Preparado para listar y para detalle por ID.
 */

// Estados posibles según doc (ACTIVE | ARCHIVED)
export const ProjectStatusDtoSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export type ProjectStatusDTO = z.infer<typeof ProjectStatusDtoSchema>

/** Item del listado/detalle (claves snake_case del backend) */
export const ProjectItemDtoSchema = z.object({
  project_id: z.string(),
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: ProjectStatusDtoSchema.optional(),
  user_ids: z.array(z.string()).default([]).optional(), // siempre presentes (vacíos si no hay)
  facility_ids: z.array(z.string()).default([]).optional(), // idem
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
})
export type ProjectItemDTO = z.infer<typeof ProjectItemDtoSchema>

/** Respuesta de listado: GET /api/projects */
export const ProjectsListResponseDtoSchema = z.object({
  data: z.object({
    projects: z.array(ProjectItemDtoSchema),
    limit: z.number().optional(),
    cursor: z.string().optional(), // aparece solo si hay más páginas
  }),
  status: z.literal('success'),
})
export type ProjectsListResponseDTO = z.infer<typeof ProjectsListResponseDtoSchema>

/** Respuesta de detalle: GET /api/projects/{project_id} */
export const ProjectDetailResponseDtoSchema = z.object({
  data: z.object({
    project: ProjectItemDtoSchema,
  }),
  status: z.literal('success'),
})
export type ProjectDetailResponseDTO = z.infer<typeof ProjectDetailResponseDtoSchema>

/** Estructura de error común en la API */
export const ErrorResponseDtoSchema = z.object({
  message: z.string(),
  status: z.literal('error'),
})
export type ErrorResponseDTO = z.infer<typeof ErrorResponseDtoSchema>
