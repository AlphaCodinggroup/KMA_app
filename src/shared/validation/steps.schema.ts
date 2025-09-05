import { z } from 'zod'

/** Fields de formularios dinámicos */
export const FieldSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('text'),
    label: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('number'),
    label: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('photo'),
    label: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('button'),
    label: z.string(),
  }),
])
export type Field = z.infer<typeof FieldSchema>

/** Steps */
export const QuestionStepSchema = z.object({
  id: z.string(),
  type: z.literal('Question'),
  text: z.string(),
  yesNext: z.string().optional(),
  noNext: z.string().optional(),
  options: z.array(z.string()).optional(),
})

export const FormStepSchema = z.object({
  id: z.string(),
  type: z.literal('Form'),
  title: z.string(),
  fields: z.array(FieldSchema),
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

export type QuestionStep = z.infer<typeof QuestionStepSchema>
export type FormStep = z.infer<typeof FormStepSchema>
export type EndStep = z.infer<typeof EndStepSchema>
export type Step = z.infer<typeof StepSchema>

/** Detalle de Flow completo */
export const FlowDetailSchema = z.object({
  flowId: z.string(),
  title: z.string(),
  version: z.string(),
  steps: z.array(StepSchema),
})
export type FlowDetail = z.infer<typeof FlowDetailSchema>
