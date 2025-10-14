export interface FlowSummary {
  id: string
  title: string
  version: string
  description?: string
  stepsCount?: number
}

/* ------------------------------ Dominio completo ------------------------------ */

export type FieldType = 'text' | 'number' | 'photo' | 'button'

export interface FormField {
  id: string
  type: FieldType
  label: string
}

export interface SelectOption {
  label: string
  next: string
}

/** Paso: Pregunta binaria (sí/no) con ramificaciones */
export interface QuestionStep {
  id: string
  type: 'Question'
  text: string
  yesNext?: string
  noNext?: string
  barrierId?: string
}

/** Paso: Formulario dinámico con campos */
export interface FormStep {
  id: string
  type: 'Form'
  title: string
  next?: string
  barrierId?: string
  fields: FormField[]
}

/** Paso: Selección de una opción (cada opción define su “next”) */
export interface SelectStep {
  id: string
  type: 'Select'
  title?: string
  text?: string
  options: SelectOption[]
}

/** Paso terminal */
export interface EndStep {
  id: string
  type: 'End'
}

/** Unión discriminada de pasos soportados por el FlowRunner */
export type Step = QuestionStep | FormStep | SelectStep | EndStep

/** Flow completo listo para ejecutar en el runner */
export interface Flow {
  id: string
  title: string
  description?: string
  steps: Step[]
  flowType?: string
  version: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/* ------------------------------ Type Guards útiles (opcionales) ------------------------------ */

export const isQuestionStep = (s: Step): s is QuestionStep => s.type === 'Question'
export const isFormStep = (s: Step): s is FormStep => s.type === 'Form'
export const isSelectStep = (s: Step): s is SelectStep => s.type === 'Select'
export const isEndStep = (s: Step): s is EndStep => s.type === 'End'
