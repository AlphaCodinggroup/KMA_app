import { z } from 'zod'

// Question
export const QuestionStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('Question'),
  text: z.string(),
  yes_next: z.string().optional(),
  no_next: z.string().optional(),
  barrier_id: z.string().optional(),
})

// Form fields
export const FormFieldDtoSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'number', 'photo', 'button']),
  label: z.string(),
})

// Form
export const FormStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('Form'),
  title: z.string(),
  next: z.string().optional(),
  barrier_id: z.string().optional(),
  fields: z.array(FormFieldDtoSchema),
})

// Select option
export const SelectOptionDtoSchema = z.object({
  label: z.string(),
  next: z.string(),
})

// Select
export const SelectStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('Select'),
  title: z.string().optional(),
  text: z.string().optional(),
  options: z.array(SelectOptionDtoSchema).min(1),
})

// End
export const EndStepDtoSchema = z.object({
  id: z.string(),
  type: z.literal('End'),
})

// Unión de Steps
export const StepDtoSchema = z.union([
  QuestionStepDtoSchema,
  FormStepDtoSchema,
  SelectStepDtoSchema,
  EndStepDtoSchema,
])

// ---------- Flow (DTO) ----------
export const FlowDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  steps: z.array(StepDtoSchema).min(1),
  flow_type: z.string().optional(),
  version: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

// ---------- Respuesta raíz ----------
export const FlowsResponseDtoSchema = z.object({
  flows: z.array(FlowDtoSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

// ---------- Tipos inferidos ----------
export type QuestionStepDto = z.infer<typeof QuestionStepDtoSchema>
export type FormFieldDto = z.infer<typeof FormFieldDtoSchema>
export type FormStepDto = z.infer<typeof FormStepDtoSchema>
export type SelectOptionDto = z.infer<typeof SelectOptionDtoSchema>
export type SelectStepDto = z.infer<typeof SelectStepDtoSchema>
export type EndStepDto = z.infer<typeof EndStepDtoSchema>
export type StepDto = z.infer<typeof StepDtoSchema>

export type FlowDto = z.infer<typeof FlowDtoSchema>
export type FlowsResponseDto = z.infer<typeof FlowsResponseDtoSchema>
