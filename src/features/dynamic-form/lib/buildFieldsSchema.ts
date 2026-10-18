import { z } from 'zod'
import type { FormField } from '@shared/validation/steps.schema'

const NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)$/

export const countPhotos = (v: unknown): number => {
  if (Array.isArray(v)) return v.length
  if (typeof v === 'string') return v ? 1 : 0
  return 0
}

/** Valor de texto tolerante: undefined/null → '' y number → string (drafts o respuestas de backend). */
const textLike = () =>
  z.preprocess(v => (v == null ? '' : typeof v === 'number' ? String(v) : v), z.string())

/** True si algún field declara `required` (backend nuevo); si no, rige la regla legacy. */
export const hasRequiredFields = (fields: readonly FormField[]): boolean =>
  fields.some(f => f.required !== undefined)

/**
 * Schema Zod dinámico para un Form step, con errores por campo.
 * - text: no vacío si `required`.
 * - number: si hay valor debe ser numérico; obligatorio si `required`.
 * - photo: al menos una foto si `required`.
 * - button: sin valor.
 * La regla legacy (al menos una foto entre todos los campos photo) la maneja el form cuando
 * ningún field trae `required`.
 */
export function buildFieldsSchema(fields: readonly FormField[]) {
  const shape: Record<string, z.ZodType> = {}

  for (const f of fields) {
    const required = f.required === true
    switch (f.type) {
      case 'text':
        shape[f.id] = textLike().refine(
          v => !required || v.trim().length > 0,
          'This field is required',
        )
        break
      case 'number':
        shape[f.id] = textLike()
          .superRefine((v, ctx) => {
            const value = v.trim()
            if (!value) {
              if (required) ctx.addIssue({ code: 'custom', message: 'This field is required' })
              return
            }
            if (!NUMBER_RE.test(value)) {
              ctx.addIssue({ code: 'custom', message: 'Enter a valid number' })
            }
          })
          // El valor enviado queda sin espacios (se validó recortado)
          .transform(v => v.trim())
        break
      case 'photo':
        shape[f.id] = z
          .unknown()
          .refine(v => !required || countPhotos(v) > 0, 'At least one photo is required')
        break
      case 'button':
        break
    }
  }

  // loose: conserva claves no declaradas (no se pierden valores al enviar)
  return z.looseObject(shape)
}
