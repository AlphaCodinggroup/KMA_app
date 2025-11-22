export type LetterKey = 'ALL' | string

function normalizeFirstLetter(value: string | undefined | null): string | '' {
  if (!value) return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  // Normalizar acentos: á → a, é → e, etc.
  const [firstChar] = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  if (!firstChar) return ''

  // Si no es letra A-Z, podrías devolver '#' o directamente ignorar
  if (!/[A-Z]/.test(firstChar)) return ''

  return firstChar
}

/**
 * Devuelve el conjunto de letras disponibles para un listado.
 */
export function getAvailableLetters<T>(
  items: readonly T[],
  getText: (item: T) => string | undefined | null,
): string[] {
  const set = new Set<string>()

  for (const item of items) {
    const letter = normalizeFirstLetter(getText(item))
    if (letter) set.add(letter)
  }

  return Array.from(set).sort()
}

/**
 * Filtra items por letra seleccionada.
 */
export function filterItemsByLetter<T>(
  items: T[],
  selected: LetterKey,
  getText: (item: T) => string | undefined | null,
): T[] {
  if (selected === 'ALL') return items

  return items.filter(item => {
    const letter = normalizeFirstLetter(getText(item))
    return letter === selected
  })
}
