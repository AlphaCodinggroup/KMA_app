import type {
  FlowsResponseDTO,
  FlowItemDTO,
  StepDTO,
  QuestionStepDTO,
  FormStepDTO,
  SelectStepDTO,
  EndStepDTO,
  StepFieldDTO,
  SelectOptionDTO,
} from '@entities/flow/api/flow.dto'
import type {
  Flow,
  Step,
  QuestionStep,
  FormStep,
  SelectStep,
  EndStep,
  Field,
  SelectOption,
} from '@entities/flow/model'

/**
 * Mapeadores DTO → Dominio (camelCase)
 * -----------------------------------
 * Conservan TODO el contenido (incluyendo metadatos) para que SelectorScreen reciba
 * la info completa aunque no toda se muestre en UI.
 */

// --------------------
// Helpers de fields/opciones
// --------------------
function mapField(dto: StepFieldDTO): Field {
  return {
    id: dto.id,
    type: dto.type,
    label: dto.label,
  }
}

function mapSelectOption(dto: SelectOptionDTO): SelectOption {
  return {
    label: dto.label,
    next: dto.next,
  }
}

// --------------------
// Steps
// --------------------
function mapQuestion(dto: QuestionStepDTO): QuestionStep {
  return {
    id: dto.id,
    type: 'Question',
    text: dto.text,
    yesNext: dto.yes_next,
    noNext: dto.no_next,
    barrierId: dto.barrier_id,
    image: dto.image,
  }
}

function mapForm(dto: FormStepDTO): FormStep {
  return {
    id: dto.id,
    type: 'Form',
    title: dto.title,
    next: dto.next,
    barrierId: dto.barrier_id,
    fields: dto.fields.map(mapField),
    image: dto.image,
  }
}

function mapSelect(dto: SelectStepDTO): SelectStep {
  return {
    id: dto.id,
    type: 'Select',
    text: dto.text,
    title: dto.title,
    options: dto.options.map(mapSelectOption),
    image: dto.image,
  }
}

function mapEnd(dto: EndStepDTO): EndStep {
  return {
    id: dto.id,
    type: 'End',
    image: dto.image,
  }
}

function mapStep(dto: StepDTO): Step {
  switch (dto.type) {
    case 'Question':
      return mapQuestion(dto)
    case 'Form':
      return mapForm(dto)
    case 'Select':
      return mapSelect(dto)
    case 'End':
      return mapEnd(dto)
    default: {
      // Exhaustividad en tiempo de compilación; si aparece un tipo nuevo, forzará cambio aquí
      const _exhaustive: never = dto as never
      return _exhaustive
    }
  }
}

// --------------------
// Flow
// --------------------
export function mapFlowItemDto(dto: FlowItemDTO): Flow {
  return {
    flowId: dto.id,
    title: dto.title,
    description: dto.description,
    steps: dto.steps.map(mapStep),
    flowType: dto.flow_type,
    version: dto.version,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

export function mapFlowsResponseDto(dto: FlowsResponseDTO): Flow[] {
  return dto.flows.map(mapFlowItemDto)
}

// Exports internos útiles en tests
export const __test_only__ = {
  mapStep,
  mapQuestion,
  mapForm,
  mapSelect,
  mapEnd,
  mapField,
  mapSelectOption,
}
