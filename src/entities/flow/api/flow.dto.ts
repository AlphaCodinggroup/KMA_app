import { z } from 'zod'

/**
 * DTOs Zod para GET /flows
 * Mantienen los nombres EXACTOS del payload (snake_case en algunas claves)
 * para validar y luego mapear a dominio (camelCase) en los mappers.
 */

// ---- Subtipos comunes
export const StepFieldDtoSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'number', 'photo', 'button']),
  label: z.string(),
})
export type StepFieldDTO = z.infer<typeof StepFieldDtoSchema>

export const SelectOptionDtoSchema = z.object({
  label: z.string(),
  next: z.string(),
})
export type SelectOptionDTO = z.infer<typeof SelectOptionDtoSchema>

// ---- Variantes de Step
export const QuestionStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('Question'),
  text: z.string(),
  yes_next: z.string().optional(),
  no_next: z.string().optional(),
  barrier_id: z.string().optional(),
  image: z.string().optional(),
})
export type QuestionStepDTO = z.infer<typeof QuestionStepDtoSchema>

export const FormStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('Form'),
  title: z.string(),
  next: z.string().optional(),
  barrier_id: z.string().optional(),
  fields: z.array(StepFieldDtoSchema),
  image: z.string().optional(),
})
export type FormStepDTO = z.infer<typeof FormStepDtoSchema>

// "Select" puede venir con `text` o con `title` (según el flujo)
export const SelectStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('Select'),
  text: z.string().optional(),
  title: z.string().optional(),
  options: z.array(SelectOptionDtoSchema),
  image: z.string().optional(),
})
export type SelectStepDTO = z.infer<typeof SelectStepDtoSchema>

export const EndStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('End'),
  image: z.string().optional(),
})
export type EndStepDTO = z.infer<typeof EndStepDtoSchema>

export const StepDtoSchema = z.union([
  QuestionStepDtoSchema,
  FormStepDtoSchema,
  SelectStepDtoSchema,
  EndStepDtoSchema,
])
export type StepDTO = z.infer<typeof StepDtoSchema>

// ---- Flow item
export const FlowItemDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  steps: z.array(StepDtoSchema),
  flow_type: z.string().optional(),
  version: z.number(),
  is_active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})
export type FlowItemDTO = z.infer<typeof FlowItemDtoSchema>

// ---- Respuesta GET /flows
export const FlowsResponseDtoSchema = z.object({
  flows: z.array(FlowItemDtoSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})
export type FlowsResponseDTO = z.infer<typeof FlowsResponseDtoSchema>
