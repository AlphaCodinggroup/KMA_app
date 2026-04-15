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
  unit: z.string().optional(),
  placeholder: z.string().optional(),
})
export type StepFieldDTO = z.infer<typeof StepFieldDtoSchema>

export const OptionConditionDtoSchema = z.object({
  step_id: z.string(),
  answer: z.string(),
})
export type OptionConditionDTO = z.infer<typeof OptionConditionDtoSchema>

export const SelectOptionDtoSchema = z.object({
  label: z.string(),
  next: z.string().optional(),
  yes_next: z.string().optional(),
  no_next: z.string().optional(),
  condition: OptionConditionDtoSchema.optional(),
  barrier_id: z.string().optional(),
})
export type SelectOptionDTO = z.infer<typeof SelectOptionDtoSchema>

export const QuestionConditionDtoSchema = z.object({
  type: z.literal('Question').optional(),
  step_id: z.string(),
  answer: z.union([z.boolean(), z.string()]),
})

export const SelectConditionDtoSchema = z.object({
  type: z.literal('Select').optional(),
  step_id: z.string(),
  selected_option: z.string(),
})

export const StepConditionDtoSchema = z.union([
  QuestionConditionDtoSchema,
  SelectConditionDtoSchema,
])
export type StepConditionDTO = z.infer<typeof StepConditionDtoSchema>

export const ConditionalNextDtoSchema = z.object({
  conditions: z.array(StepConditionDtoSchema),
  next: z.string(),
  match_any: z.boolean().optional(),
})
export type ConditionalNextDTO = z.infer<typeof ConditionalNextDtoSchema>

const StepMediaDtoSchema = z.object({
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
})

// ---- Variantes de Step
export const QuestionStepDtoSchema = StepMediaDtoSchema.extend({
  id: z.string(),
  type: z.literal('Question'),
  text: z.string(),
  yes_next: z.string().optional(),
  no_next: z.string().optional(),
  barrier_id: z.string().optional(),
  check_previous_nos: z.array(z.string()).optional(),
  conditional_yes_next: z
    .union([ConditionalNextDtoSchema, z.array(ConditionalNextDtoSchema)])
    .optional(),
  conditional_no_next: z
    .union([ConditionalNextDtoSchema, z.array(ConditionalNextDtoSchema)])
    .optional(),
})
export type QuestionStepDTO = z.infer<typeof QuestionStepDtoSchema>

export const FormStepDtoSchema = StepMediaDtoSchema.extend({
  id: z.string(),
  type: z.literal('Form'),
  title: z.string().optional(),
  next: z.string().optional(),
  barrier_id: z.string().optional(),
  // Algunos flows remotos están enviando Form sin `fields`.
  // Lo normalizamos a [] para no invalidar todo el catálogo.
  fields: z.preprocess(value => value ?? [], z.array(StepFieldDtoSchema)),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type FormStepDTO = z.infer<typeof FormStepDtoSchema>

// "Select" puede venir con `text` o con `title` (según el flujo)
export const SelectStepDtoSchema = StepMediaDtoSchema.extend({
  id: z.string(),
  type: z.literal('Select'),
  text: z.string().optional(),
  title: z.string().optional(),
  options: z.array(SelectOptionDtoSchema),
})
export type SelectStepDTO = z.infer<typeof SelectStepDtoSchema>

export const EndStepDtoSchema = StepMediaDtoSchema.extend({
  id: z.string(),
  type: z.literal('End'),
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
  version: z.union([z.number(), z.string()]),
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
