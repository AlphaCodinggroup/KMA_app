import type { FormField } from '@shared/validation/steps.schema'

/**
 * Defensa: backend ya envía `fields` ordenado. Si algún field trae `order`, se ordena de
 * forma estable por ese valor (los que no lo traen conservan su posición relativa, al final).
 * Si ninguno lo trae, devuelve el mismo array.
 */
export function sortFields(fields: readonly FormField[]): readonly FormField[] {
  if (!fields.some(f => typeof f.order === 'number' && Number.isFinite(f.order))) return fields

  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const ao = Number.isFinite(a.field.order) ? (a.field.order as number) : Infinity
      const bo = Number.isFinite(b.field.order) ? (b.field.order as number) : Infinity
      if (ao === bo) return a.index - b.index
      return ao < bo ? -1 : 1
    })
    .map(x => x.field)
}
