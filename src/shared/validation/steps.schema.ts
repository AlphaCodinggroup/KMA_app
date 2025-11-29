import { z } from 'zod'

/**
 * Tipos de campo permitidos en formularios dinámicos.
 */
export const FieldTypeSchema = z.enum(['text', 'number', 'photo', 'button'])
export type FieldType = z.infer<typeof FieldTypeSchema>

/* --------------------------------- Form ---------------------------------- */

export const FormFieldSchema = z.object({
  id: z.string(),
  type: FieldTypeSchema,
  label: z.string(),
})
export type FormField = z.infer<typeof FormFieldSchema>

export const FormStepSchema = z.object({
  id: z.string(),
  type: z.literal('Form'),
  title: z.string(),
  next: z.string().optional(),
  barrierId: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1),
  image: z.string().optional(),
})
export type FormStep = z.infer<typeof FormStepSchema>

/* ------------------------------- Question -------------------------------- */

export const QuestionStepSchema = z.object({
  id: z.string(),
  type: z.literal('Question'),
  text: z.string(),
  yesNext: z.string().optional(),
  noNext: z.string().optional(),
  image: z.string().optional(),
  barrierId: z.string().optional(),
})
export type QuestionStep = z.infer<typeof QuestionStepSchema>

/* -------------------------------- Select --------------------------------- */

export const SelectOptionSchema = z.object({
  label: z.string(),
  next: z.string(),
})
export type SelectOption = z.infer<typeof SelectOptionSchema>

export const SelectStepSchema = z.object({
  id: z.string(),
  type: z.literal('Select'),
  title: z.string().optional(),
  text: z.string().optional(),
  options: z.array(SelectOptionSchema).min(1),
  image: z.string().optional(),
})
export type SelectStep = z.infer<typeof SelectStepSchema>

/* ---------------------------------- End ---------------------------------- */

export const EndStepSchema = z.object({
  id: z.string(),
  type: z.literal('End'),
  image: z.string().optional(),
})
export type EndStep = z.infer<typeof EndStepSchema>

/* ------------------------- Unión discriminada Step ------------------------ */
/**
 * Discriminated union por "type" para inferencia exhaustiva en la UI.
 */
export const StepSchema = z.discriminatedUnion('type', [
  QuestionStepSchema,
  FormStepSchema,
  SelectStepSchema,
  EndStepSchema,
])
export type Step = z.infer<typeof StepSchema>

/* ------------------------------ FlowDetail ------------------------------- */

/**
 * FlowDetail se usa en dos mundos:
 *  - cache / repos: generalmente viene con version
 *  - runner (params de navegación): muchas veces solo manda flowId/title/steps
 *
 * Por eso version se marca opcional: los repos la normalizan con `normalizeVersion`,
 * y el runner no se rompe si no la tiene.
 */
export const FlowDetailSchema = z.object({
  flowId: z.string(),
  title: z.string(),
  version: z.string().optional(),
  steps: z.array(StepSchema).min(1),
})
export type FlowDetail = z.infer<typeof FlowDetailSchema>

/* ---------------------------- Type Guards (opc) --------------------------- */

export const isQuestionStep = (s: Step): s is QuestionStep => s.type === 'Question'
export const isFormStep = (s: Step): s is FormStep => s.type === 'Form'
export const isSelectStep = (s: Step): s is SelectStep => s.type === 'Select'
export const isEndStep = (s: Step): s is EndStep => s.type === 'End'
