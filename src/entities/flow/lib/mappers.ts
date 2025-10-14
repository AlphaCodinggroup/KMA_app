import {
  FlowsResponseDtoSchema,
  FlowDtoSchema,
  StepDtoSchema,
  type FlowsResponseDto,
  type FlowDto,
  type StepDto,
  type QuestionStepDto,
  type FormStepDto,
  type SelectStepDto,
  type EndStepDto,
  type SelectOptionDto,
  type FormFieldDto,
} from '../api/flow.dto'

import type {
  Flow,
  Step,
  QuestionStep,
  FormStep,
  SelectStep,
  EndStep,
  FormField,
  SelectOption as DomainSelectOption,
} from '../model'

/**
 * Valida y parsea con Zod la respuesta raíz de /flows.
 * Usalo cuando hagas el fetch para garantizar estructura antes de mapear.
 */
export function parseFlowsResponseDto(json: unknown): FlowsResponseDto {
  return FlowsResponseDtoSchema.parse(json)
}

/**
 * Valida y parsea un FlowDto suelto.
 */
export function parseFlowDto(json: unknown): FlowDto {
  return FlowDtoSchema.parse(json)
}

/**
 * Valida y parsea un StepDto suelto.
 */
export function parseStepDto(json: unknown): StepDto {
  return StepDtoSchema.parse(json)
}

/* --------------------------------- Utils --------------------------------- */

function mapFormFieldDto(dto: FormFieldDto): FormField {
  return {
    id: dto.id,
    type: dto.type, // 'text' | 'number' | 'photo' | 'button'
    label: dto.label,
  }
}

function mapSelectOptionDto(dto: SelectOptionDto): DomainSelectOption {
  return {
    label: dto.label,
    next: dto.next,
  }
}

/* ------------------------------- Steps mapper ------------------------------ */

function mapQuestionStepDto(dto: QuestionStepDto): QuestionStep {
  return {
    id: dto.id,
    type: 'Question',
    text: dto.text,
    ...(dto.yes_next !== undefined ? { yesNext: dto.yes_next } : {}),
    ...(dto.no_next !== undefined ? { noNext: dto.no_next } : {}),
    ...(dto.barrier_id !== undefined ? { barrierId: dto.barrier_id } : {}),
  }
}

function mapFormStepDto(dto: FormStepDto): FormStep {
  return {
    id: dto.id,
    type: 'Form',
    title: dto.title,
    ...(dto.next !== undefined ? { next: dto.next } : {}),
    ...(dto.barrier_id !== undefined ? { barrierId: dto.barrier_id } : {}),
    fields: dto.fields.map(mapFormFieldDto),
  }
}

function mapSelectStepDto(dto: SelectStepDto): SelectStep {
  return {
    id: dto.id,
    type: 'Select',
    ...(dto.title !== undefined ? { title: dto.title } : {}),
    ...(dto.text !== undefined ? { text: dto.text } : {}),
    options: dto.options.map(mapSelectOptionDto),
  }
}

function mapEndStepDto(dto: EndStepDto): EndStep {
  return {
    id: dto.id,
    type: 'End',
  }
}

export function mapStepDto(dto: StepDto): Step {
  switch (dto.type) {
    case 'Question':
      return mapQuestionStepDto(dto)
    case 'Form':
      return mapFormStepDto(dto)
    case 'Select':
      return mapSelectStepDto(dto)
    case 'End':
      return mapEndStepDto(dto)
    default: {
      const _exhaustive: never = dto as never
      throw new Error(`mapStepDto: Tipo de Step no soportado: ${_exhaustive}`)
    }
  }
}

/* -------------------------------- Flow mapper ------------------------------ */

export function mapFlowDto(dto: FlowDto): Flow {
  return {
    id: dto.id,
    title: dto.title,
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    steps: dto.steps.map(mapStepDto),
    ...(dto.flow_type !== undefined ? { flowType: dto.flow_type } : {}),
    version: dto.version,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

/**
 * Mapea la respuesta de /flows a una lista de Flows de dominio + metadata bruta si la necesitas.
 * De momento solo devolvemos el array de Flows porque es lo que consume la app.
 * Si luego querés paginado real, podemos exponer { items, total, limit, offset }.
 */
export function mapFlowsResponseDto(dto: FlowsResponseDto): Flow[] {
  return dto.flows.map(mapFlowDto)
}
