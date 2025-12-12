import {
  StepSchema,
  type Step,
  type QuestionStep,
  type SelectStep,
} from '@shared/validation/steps.schema'

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
 * (fallback de bajo nivel por si Zod falla pero la estructura es "usable").
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
 *
 * - `rawSteps` viene de los params de Expo Router (string | string[] | undefined).
 * - Primero intentamos parsear + validar con Zod (StepSchema[]).
 * - Si Zod falla pero la estructura mínima está bien, caemos al validador liviano
 *   para no romper flujos antiguos.
 * - Si nada sirve, se lanza error.
 */
export function parseStepsParam(rawSteps: string | string[] | undefined): Step[] {
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

  // Intentamos validación "full" con Zod
  const zodResult = StepSchema.array().safeParse(parsed)
  if (zodResult.success) {
    return zodResult.data
  }

  // Fallback: estructura mínima compatible con el runner
  if (isValidStepsPayload(parsed)) return parsed as Step[]

  //  Nada sirve → error explícito
  throw new Error('Steps payload does not match expected shape')
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
 *
 * usamos SelectStep del schema compartido, no del UI,
 * para evitar dependencias circulares entre lib/ y ui/.
 */
export const toVirtualQuestion = (s: SelectStep): QuestionStep => ({
  id: s.id,
  type: 'Question',
  text: s.title ?? s.text ?? '',
  image: s.image,
})
