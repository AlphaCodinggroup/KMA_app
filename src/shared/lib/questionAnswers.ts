export const QUESTION_ANSWER_VALUES = ['YES', 'NO', 'UNSURE'] as const

export type QuestionAnswerValue = (typeof QUESTION_ANSWER_VALUES)[number]

export function normalizeQuestionAnswerValue(value: unknown): QuestionAnswerValue | null {
  if (typeof value === 'boolean') {
    return value ? 'YES' : 'NO'
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase()

    if (QUESTION_ANSWER_VALUES.includes(normalized as QuestionAnswerValue)) {
      return normalized as QuestionAnswerValue
    }
  }

  return null
}
