import {
  isQuestionCondition,
  isSelectCondition,
  type StepCondition as FlowStepCondition,
} from '@entities/flow/model'
import type { SubmissionAnswer } from '@entities/submission/model'
import { normalizeQuestionAnswerValue, type QuestionAnswerValue } from '@shared/lib/questionAnswers'
import type { QuestionStep, SelectOption, Step } from '@shared/validation/steps.schema'

export type FlowRunnerAnswers = Record<string, SubmissionAnswer>

export type StoredQuestionState = {
  decision: QuestionAnswerValue | null
  option: string | null
}

export function getNormalizedQuestionAnswer(
  answers: FlowRunnerAnswers,
  stepId: string,
): QuestionAnswerValue | null {
  const stored = answers[stepId]
  if (!stored || stored.type !== 'Question') return null

  return normalizeQuestionAnswerValue(stored.answer)
}

export function getStoredQuestionState(
  answers: FlowRunnerAnswers,
  stepId: string,
): StoredQuestionState {
  const stored = answers[stepId]
  if (!stored || stored.type !== 'Question') {
    return {
      decision: null,
      option: null,
    }
  }

  return {
    decision: normalizeQuestionAnswerValue(stored.answer),
    option: stored.option ?? null,
  }
}

function matchesStepCondition(answers: FlowRunnerAnswers, condition: FlowStepCondition): boolean {
  const stored = answers[condition.stepId]
  if (!stored || stored.type !== 'Question') return false

  if (isQuestionCondition(condition)) {
    const actual = normalizeQuestionAnswerValue(stored.answer)
    const expected = normalizeQuestionAnswerValue(condition.answer)

    if (!actual || !expected) return false
    return actual === expected
  }

  if (isSelectCondition(condition)) {
    return stored.option === condition.selectedOption
  }

  return false
}

export function resolveQuestionNextStep(
  step: QuestionStep,
  answer: QuestionAnswerValue,
  answers: FlowRunnerAnswers,
): string | null {
  const answeredYes = answer === 'YES'
  const rules = answeredYes ? step.conditionalYesNext : step.conditionalNoNext

  if (rules && rules.length > 0) {
    for (const rule of rules) {
      const pass = rule.matchAny
        ? rule.conditions.some(condition => matchesStepCondition(answers, condition))
        : rule.conditions.every(condition => matchesStepCondition(answers, condition))

      if (pass) return rule.next
    }
  }

  const defaultNext = answeredYes
    ? (step.yesNext ?? step.noNext ?? null)
    : (step.noNext ?? step.yesNext ?? null)

  // Legacy: checkPreviousNos solo modifica la navegación del camino YES.
  // Para NO/UNSURE debemos respetar exactamente la rama noNext.
  if (!answeredYes) {
    return defaultNext
  }

  if (!Array.isArray(step.checkPreviousNos) || step.checkPreviousNos.length === 0) {
    return defaultNext
  }

  const previousAnswers = step.checkPreviousNos.map(stepId =>
    getNormalizedQuestionAnswer(answers, stepId),
  )
  const hasNo = previousAnswers.some(value => value === 'NO' || value === 'UNSURE')
  const allYes = step.checkPreviousNos.length > 0 && previousAnswers.every(value => value === 'YES')

  if (hasNo) return step.noNext ?? step.yesNext ?? defaultNext
  if (allYes) return step.yesNext ?? step.noNext ?? defaultNext

  // Si falta info, preferimos el camino defensivo (noNext) para no saltar validaciones.
  return step.noNext ?? step.yesNext ?? defaultNext
}

export function resolveSelectOptionNext(
  option: SelectOption,
  answers: FlowRunnerAnswers,
): string | null {
  if (option.condition) {
    const expected = normalizeQuestionAnswerValue(option.condition.answer) ?? ''
    const actual = getNormalizedQuestionAnswer(answers, option.condition.stepId) ?? ''
    const matches = actual === expected

    if (matches) {
      return option.yesNext ?? option.next ?? option.noNext ?? null
    }
    return option.noNext ?? option.next ?? option.yesNext ?? null
  }

  return option.next ?? option.yesNext ?? option.noNext ?? null
}

export function getStepIdsAfter(visibleIds: string[], stepId: string): string[] {
  const index = visibleIds.indexOf(stepId)
  if (index === -1) return []

  return visibleIds.slice(index + 1)
}

export function sliceVisibleIdsAfterStep(visibleIds: string[], stepId: string): string[] {
  const index = visibleIds.indexOf(stepId)
  if (index === -1) return visibleIds

  return visibleIds.slice(0, index + 1)
}

export function appendVisibleId(visibleIds: string[], nextId: string | null): string[] {
  if (!nextId) return visibleIds
  if (visibleIds[visibleIds.length - 1] === nextId) return visibleIds

  return [...visibleIds, nextId]
}

export function removeAnswers(answers: FlowRunnerAnswers, stepIds: string[]): void {
  for (const stepId of stepIds) {
    delete answers[stepId]
  }
}

export function bumpRenderVersions(
  current: Record<string, number>,
  stepIds: string[],
): Record<string, number> {
  if (stepIds.length === 0) return current

  const next = { ...current }

  for (const stepId of stepIds) {
    next[stepId] = (next[stepId] ?? 0) + 1
  }

  return next
}

const END = 'END'

/**
 * Reconstruye los pasos visibles a partir de las respuestas guardadas (reanudar un draft).
 * Camina desde el primer paso aplicando las mismas reglas de navegación del runner y se detiene en el
 * primer paso sin respuesta (el que hay que contestar ahora) o en END. Los ciclos se cortan.
 */
export function replayPath(steps: Step[], answers: FlowRunnerAnswers): string[] {
  const byId = new Map(steps.map(s => [s.id, s]))
  const resolve = (next?: string | null): string | null => {
    if (!next) return byId.has(END) ? END : null
    return byId.has(next) ? next : byId.has(END) ? END : null
  }

  const first = steps[0]?.id ?? (byId.has(END) ? END : null)
  const path: string[] = []
  const seen = new Set<string>()
  let current: string | null = first

  while (current && !seen.has(current)) {
    seen.add(current)
    path.push(current)

    const step = byId.get(current)
    const stored = answers[current]
    if (!step || !stored || step.type === 'End') break

    let rawNext: string | null | undefined
    if (step.type === 'Question') {
      if (stored.type !== 'Question') break
      const answer = normalizeQuestionAnswerValue(stored.answer)
      if (!answer) break
      rawNext = resolveQuestionNextStep(step, answer, answers)
    } else if (step.type === 'Select') {
      if (stored.type !== 'Question') break
      const option = step.options.find(o => o.label === stored.option)
      if (!option) break
      rawNext = resolveSelectOptionNext(option, answers)
    } else {
      if (stored.type !== 'Form') break
      rawNext = step.next ?? null
    }

    current = resolve(rawNext)
  }

  return path
}
