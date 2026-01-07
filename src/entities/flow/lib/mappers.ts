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
  StepConditionDTO,
  ConditionalNextDTO,
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
  StepCondition,
  ConditionalNext,
} from '@entities/flow/model'

/**
 * Mapeadores DTO → Dominio (camelCase)
 * -----------------------------------
 * Conservan TODO el contenido (incluyendo metadatos) para que SelectorScreen reciba
 * la info completa aunque no toda se muestre en UI.
 */

// --------------------
// Helpers
// --------------------
/**
 * Normaliza la versión a un número “sano” (>0).
 * Admite formatos tipo "1", "1.0", "v1", etc.
 */
function normalizeVersion(value: FlowItemDTO['version'] | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 1

    // Soporta "v1", "V2", "1.0", etc.
    const numeric = Number(trimmed.replace(/^v/i, ''))
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric
    }
  }

  return 1
}

// --------------------
// Helpers de fields/opciones
// --------------------
function mapField(dto: StepFieldDTO): Field {
  return {
    id: dto.id,
    type: dto.type,
    label: dto.label,
    unit: dto.unit,
    placeholder: dto.placeholder,
  }
}

function mapSelectOption(dto: SelectOptionDTO): SelectOption {
  return {
    label: dto.label,
    next: dto.next,
    yesNext: dto.yes_next,
    noNext: dto.no_next,
    barrierId: dto.barrier_id,
    condition: dto.condition
      ? {
          stepId: dto.condition.step_id,
          answer: dto.condition.answer,
        }
      : undefined,
  }
}

function mapStepCondition(dto: StepConditionDTO): StepCondition {
  if ('selected_option' in dto) {
    return {
      type: 'Select',
      stepId: dto.step_id,
      selectedOption: dto.selected_option,
    }
  }

  // Normalizar answer a boolean
  let finalAns = false
  const raw = (dto as any).answer

  if (typeof raw === 'boolean') {
    finalAns = raw
  } else if (typeof raw === 'string') {
    finalAns = raw.toUpperCase() === 'YES'
  }

  return {
    type: 'Question',
    stepId: dto.step_id,
    answer: finalAns,
  }
}

function mapConditionalNext(dto: ConditionalNextDTO): ConditionalNext {
  return {
    conditions: dto.conditions.map(mapStepCondition),
    next: dto.next,
    matchAny: dto.match_any,
  }
}

function normalizeConditionalNext(
  input?: ConditionalNextDTO | ConditionalNextDTO[],
): ConditionalNext[] | undefined {
  if (!input) return undefined
  if (Array.isArray(input)) {
    return input.map(mapConditionalNext)
  }
  return [mapConditionalNext(input)]
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
    checkPreviousNos: dto.check_previous_nos,
    conditionalYesNext: normalizeConditionalNext(dto.conditional_yes_next),
    conditionalNoNext: normalizeConditionalNext(dto.conditional_no_next),
  }
}

function mapForm(dto: FormStepDTO): FormStep {
  return {
    id: dto.id,
    type: 'Form',
    title: dto.title ?? '',
    next: dto.next,
    barrierId: dto.barrier_id,
    fields: dto.fields.map(mapField),
    image: dto.image,
    metadata: dto.metadata,
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
    flowType: dto.flow_type,
    version: normalizeVersion(dto.version),
    isActive: dto.is_active ?? true,
    createdAt: dto.created_at ?? '',
    updatedAt: dto.updated_at ?? '',
    steps: dto.steps.map(mapStep),
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
