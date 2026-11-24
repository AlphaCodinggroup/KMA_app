/**
 * Dominio: Flow
 * -------------
 * - Tipos puros para representar Flows y Steps en camelCase.
 * - Incluye helpers de type guards para facilitar el renderizado condicional en UI.
 */

import type { QuestionAnswerValue } from '@shared/lib/questionAnswers'

// --------------------
// Fields de formularios
// --------------------
export type FieldType = 'text' | 'number' | 'photo' | 'button'

export interface Field {
  id: string
  type: FieldType
  label: string
  unit?: string | undefined
  placeholder?: string | undefined
  required?: boolean | undefined
  multiline?: boolean | undefined
  order?: number | undefined
}

export interface OptionCondition {
  stepId: string
  answer: QuestionConditionAnswer
}

export interface SelectOption {
  label: string
  next?: string | undefined
  yesNext?: string | undefined
  noNext?: string | undefined
  condition?: OptionCondition | undefined
  barrierId?: string | undefined
}

export type ConditionType = 'Question' | 'Select'

export type QuestionConditionAnswer = QuestionAnswerValue

export interface QuestionCondition {
  type: 'Question'
  stepId: string
  answer: QuestionConditionAnswer
}

export interface SelectCondition {
  type: 'Select'
  stepId: string
  selectedOption: string
}

export type StepCondition = QuestionCondition | SelectCondition

export interface ConditionalNext {
  conditions: StepCondition[]
  next: string
  matchAny?: boolean | undefined
}

// --------------------
// Variantes de Step
// --------------------
export interface StepMedia {
  image?: string | undefined
  images?: string[] | undefined
}

export interface QuestionStep extends StepMedia {
  id: string
  type: 'Question'
  text: string
  yesNext?: string | undefined
  noNext?: string | undefined
  conditionalYesNext?: ConditionalNext[] | undefined
  conditionalNoNext?: ConditionalNext[] | undefined
  barrierId?: string | undefined
  checkPreviousNos?: string[] | undefined
}

export interface FormStep extends StepMedia {
  id: string
  type: 'Form'
  title: string
  next?: string | undefined
  barrierId?: string | undefined
  fields: Field[]
  metadata?: Record<string, unknown> | undefined
}

// "Select" puede venir con `text` o con `title` según el flujo
export interface SelectStep extends StepMedia {
  id: string
  type: 'Select'
  text?: string | undefined
  title?: string | undefined
  options: SelectOption[]
}

export interface EndStep extends StepMedia {
  id: string // suele ser "END"
  type: 'End'
}

export type Step = QuestionStep | FormStep | SelectStep | EndStep

// --------------------
// Entidad Flow (completa con metadatos)
// --------------------
export interface Flow {
  flowId: string // mapea desde DTO.id
  title: string
  description?: string | undefined
  steps: Step[]
  flowType?: string | undefined
  version: number
  isActive?: boolean | undefined
  createdAt?: string | undefined // ISO
  updatedAt?: string | undefined // ISO
}

// --------------------
// View Models simples
// --------------------
/** Resumen para tarjetas en Selector */
export interface FlowSummary {
  id: string
  title: string
  version?: string | number | undefined
  description?: string | undefined
  stepsCount?: number | undefined
  flowType?: string | undefined
  isActive?: boolean | undefined
  createdAt?: string | undefined // ISO
  updatedAt?: string | undefined // ISO
}

/** Payload mínimo que espera el Runner (según requerimiento del cliente) */
export type StepsPayload = Step[]

// --------------------
// Type Guards
// --------------------
export const isQuestionStep = (s: Step): s is QuestionStep => s.type === 'Question'
export const isFormStep = (s: Step): s is FormStep => s.type === 'Form'
export const isSelectStep = (s: Step): s is SelectStep => s.type === 'Select'
export const isEndStep = (s: Step): s is EndStep => s.type === 'End'

export const isQuestionCondition = (c: StepCondition): c is QuestionCondition =>
  c.type === 'Question'
export const isSelectCondition = (c: StepCondition): c is SelectCondition => c.type === 'Select'
