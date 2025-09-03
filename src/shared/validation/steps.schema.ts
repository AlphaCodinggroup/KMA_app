import { z } from 'zod'

export const FlowCatalogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
  stepsCount: z.number().int().optional(),
})

export const FlowCatalogSchema = z.object({
  flows: z.array(FlowCatalogItemSchema),
})

export const QuestionStepSchema = z.object({
  id: z.string(),
  type: z.literal('Question'),
  text: z.string(),
  yesNext: z.string().optional(),
  noNext: z.string().optional(),
  options: z.array(z.string()).optional(), // Q13, Q16
})

export const FormFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'number', 'photo', 'button']),
  label: z.string(),
})

export const FormStepSchema = z.object({
  id: z.string(),
  type: z.literal('Form'),
  title: z.string(),
  fields: z.array(FormFieldSchema),
  next: z.string().optional(),
})

export const EndStepSchema = z.object({
  id: z.string(),
  type: z.literal('End'),
  message: z.string(),
})

export const StepSchema = z.discriminatedUnion('type', [
  QuestionStepSchema,
  FormStepSchema,
  EndStepSchema,
])

export const FlowDetailSchema = z.object({
  flowId: z.string(),
  title: z.string(),
  version: z.string(),
  steps: z.array(StepSchema),
})

export const AllFlowsSchema = z.object({
  flows: z.array(FlowDetailSchema),
})

export type FlowCatalog = z.infer<typeof FlowCatalogSchema>
export type FlowDetail = z.infer<typeof FlowDetailSchema>
