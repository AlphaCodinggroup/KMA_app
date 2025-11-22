import type { Step } from '@entities/flow/model'
import type { FlowRunnerRouteParams, SelectStep } from '../ui/FlowRunnerScreen'
import type { QuestionStep } from '@shared/validation/steps.schema'

/**
 * Identificador reservado para el paso de fin de flujo.
 */
export const END_ID = 'END'

/**
 * Crea un mapa de pasos indexado por id para acceso O(1).
 */
export function mapById(steps: Step[]): Record<string, Step> {
  return steps.reduce<Record<string, Step>>((acc, s) => {
    acc[s.id] = s
    return acc
  }, {})
}

/**
 * Verifica que el payload crudo tenga la forma mínima de Step[].
 */
export function isValidStepsPayload(v: unknown): v is Step[] {
  return (
    Array.isArray(v) &&
    v.every(
      s =>
        s &&
        typeof s === 'object' &&
        typeof (s as Step).id === 'string' &&
        typeof (s as Step).type === 'string',
    )
  )
}

/**
 * Parsear el parámetro `steps` proveniente de la navegación y validarlo.
 * Lanza un error si el JSON es inválido o no coincide con la forma esperada.
 */
export function parseStepsParam(rawSteps: FlowRunnerRouteParams['steps']): Step[] {
  const stepsStr = Array.isArray(rawSteps) ? rawSteps[0] : rawSteps

  if (!stepsStr) {
    throw new Error('Missing steps payload in navigation params')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stepsStr)
  } catch (e) {
    throw new Error(`Invalid steps JSON in navigation params, ${String(e)}`)
  }

  if (!isValidStepsPayload(parsed)) {
    throw new Error('Steps payload does not match expected shape')
  }

  return parsed as Step[]
}

/**
 * Determina el id del primer paso visible siguiendo la prioridad:
 * 1) Primera Question, 2) primer step, 3) paso END si existe.
 */
export function resolveInitialStepId(steps: Step[]): string | null {
  // Primera Question si existe
  const firstQuestion = steps.find(s => s.type === 'Question')
  if (firstQuestion) return firstQuestion.id

  // Primer step cualquiera
  if (steps[0]) return steps[0].id

  // Fallback al END si existe
  const endStep = steps.find(s => s.id === END_ID)
  return endStep ? END_ID : null
}

/**
 * Adapta un SelectStep a un QuestionStep "virtual" para reutilizar QuestionCard.
 */
export const toVirtualQuestion = (s: SelectStep): QuestionStep => ({
  id: s.id,
  type: 'Question',
  text: s.title ?? s.text ?? '',
  image: s.image,
})
