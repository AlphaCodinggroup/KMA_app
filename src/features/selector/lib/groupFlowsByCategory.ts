import type { FlowSummary } from '@entities/flow/model'
import type { LetterKey } from '@shared/lib/alphaFilter'

export const OTHER_CATEGORY_KEY = '__other__'
const OTHER_CATEGORY_TITLE = 'OTHER'

export interface FlowSection {
  key: string
  title: string
  data: FlowSummary[]
}

const normalizeKey = (value: string): string => value.trim().toLowerCase()

/** Inicial A-Z (sin acentos) de una categoría; '' si no tiene. */
const categoryLetter = (title: string): string => {
  const [first] = title.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  return first && /[A-Z]/.test(first) ? first : ''
}

/**
 * Agrupa flows por categoría (`flowType`). Secciones ordenadas alfabéticamente, orden original
 * preservado dentro de cada sección, y "Other" (sin categoría) siempre al final.
 */
export function groupFlowsByCategory(summaries: readonly FlowSummary[]): FlowSection[] {
  const byKey = new Map<string, FlowSection>()
  let other: FlowSection | undefined

  for (const summary of summaries) {
    const raw = (summary.flowType ?? '').trim()

    // Una categoría literal "Other" se junta con las sin categoría (evita dos headers iguales)
    if (!raw || normalizeKey(raw) === normalizeKey(OTHER_CATEGORY_TITLE)) {
      other ??= { key: OTHER_CATEGORY_KEY, title: OTHER_CATEGORY_TITLE, data: [] }
      other.data.push(summary)
      continue
    }

    const key = normalizeKey(raw)
    let section = byKey.get(key)
    if (!section) {
      section = { key, title: raw.toUpperCase(), data: [] }
      byKey.set(key, section)
    }
    section.data.push(summary)
  }

  const sections = Array.from(byKey.values()).sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
  if (other) sections.push(other)
  return sections
}

/** Letras (inicial de categoría) disponibles para los chips. "Other" no aporta letra. */
export function getSectionLetters(sections: readonly FlowSection[]): string[] {
  const set = new Set<string>()
  for (const s of sections) {
    if (s.key === OTHER_CATEGORY_KEY) continue
    const letter = categoryLetter(s.title)
    if (letter) set.add(letter)
  }
  return Array.from(set).sort()
}

/** Deja solo las secciones cuya categoría empieza con la letra elegida. */
export function filterSectionsByLetter(
  sections: FlowSection[],
  selected: LetterKey,
): FlowSection[] {
  if (selected === 'ALL') return sections
  return sections.filter(s => s.key !== OTHER_CATEGORY_KEY && categoryLetter(s.title) === selected)
}
