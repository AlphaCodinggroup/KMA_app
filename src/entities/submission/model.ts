export type QuestionAnswer = {
  type: 'Question'
  answer: 'YES' | 'NO' | null
  option?: string | null
}
export type FormAnswer = { type: 'Form'; values: Record<string, unknown> }
export type SubmissionAnswer = QuestionAnswer | FormAnswer

export type SubmissionDraft = {
  flowId: string
  title: string
  createdAt: number
  answers: Record<string, SubmissionAnswer>
}
