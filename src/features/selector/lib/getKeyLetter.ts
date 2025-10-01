import type { FlowSummary } from '@entities/flow/model'

export const ALL = 'ALL' as const
export type LetterKey = typeof ALL | string

export function getKeyLetter(item: FlowSummary): string {
  const raw = (item?.id?.[0] || item?.title?.[0] || '').toUpperCase()
  return /[A-Z]/.test(raw) ? raw : '#'
}
