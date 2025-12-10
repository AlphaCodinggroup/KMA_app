/**
 * Dominio: Flow
 * -------------
 * - Tipos puros para representar Flows y Steps en camelCase.
 * - Incluye helpers de type guards para facilitar el renderizado condicional en UI.
 */

// --------------------
// Fields de formularios
// --------------------
export type FieldType = 'text' | 'number' | 'photo' | 'button'

export interface Field {
  id: string
  type: FieldType
  label: string
}

export interface OptionCondition {
  stepId: string
  answer: string
}

export interface SelectOption {
  label: string
  next?: string
  yesNext?: string
  noNext?: string
  condition?: OptionCondition
}

// --------------------
// Variantes de Step
// --------------------
export interface QuestionStep {
  id: string
  type: 'Question'
  text: string
  yesNext?: string
  noNext?: string
  barrierId?: string
  image?: string
  checkPreviousNos?: string[]
}

export interface FormStep {
  id: string
  type: 'Form'
  title: string
  next?: string
  barrierId?: string
  fields: Field[]
  image?: string
}

// "Select" puede venir con `text` o con `title` según el flujo
export interface SelectStep {
  id: string
  type: 'Select'
  text?: string
  title?: string
  options: SelectOption[]
  image?: string
}

export interface EndStep {
  id: string // suele ser "END"
  type: 'End'
  image?: string
}

export type Step = QuestionStep | FormStep | SelectStep | EndStep

// --------------------
// Entidad Flow (completa con metadatos)
// --------------------
export interface Flow {
  flowId: string // mapea desde DTO.id
  title: string
  description?: string
  steps: Step[]
  flowType?: string
  version: number
  isActive?: boolean
  createdAt?: string // ISO
  updatedAt?: string // ISO
}

// --------------------
// View Models simples
// --------------------
/** Resumen para tarjetas en Selector */
export interface FlowSummary {
  id: string
  title: string
  version?: string | number
  description?: string
  stepsCount?: number
  flowType?: string
  isActive?: boolean
  createdAt?: string // ISO
  updatedAt?: string // ISO
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
