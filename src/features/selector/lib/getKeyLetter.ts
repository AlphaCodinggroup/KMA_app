/**
 * Clave de filtro por letra obtenida desde `flowType`.
 * Si `flowType` no está presente, cae al título.
 */
import type { FlowSummary } from '@entities/flow/model'

export type LetterKey = 'ALL' | string

/**
 * Obtiene la primer letra A–Z en mayúscula a partir de flowType (o título).
 * Si no hay letra válida, devuelve string vacío para que el caller lo filtre.
 */
export function getKeyLetter(it: Pick<FlowSummary, 'flowType' | 'title'>): string {
  const source = (it.flowType ?? it.title ?? '').trim()
  if (!source) return ''
  const first = source[0]!.toUpperCase()
  return /[A-Z]/.test(first) ? first : ''
}
