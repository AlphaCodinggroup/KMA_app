import { z } from 'zod'
import type { FormField } from '@shared/validation/steps.schema'

const NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)$/
const NOTES_RE = /\bnot(e|es|a|as)\b/i

export const PHOTO_REQUIRED_MESSAGE = 'At least one photo is required'

export const countPhotos = (v: unknown): number => {
  if (Array.isArray(v)) return v.length
  if (typeof v === 'string') return v ? 1 : 0
  return 0
}

/** Campo de notas (por id o label): es el único campo de datos opcional. */
export const isNotesField = (f: FormField): boolean =>
  (f.type === 'text' || f.type === 'number') &&
  (NOTES_RE.test(f.id.replace(/[_-]/g, ' ')) || NOTES_RE.test(f.label))

/**
 * Regla de negocio: todos los campos de datos (text/number) son obligatorios salvo las notas,
 * sin importar el `required` que mande el backend. Las fotos se validan a nivel form.
 */
export const isFieldRequired = (f: FormField): boolean =>
  (f.type === 'text' || f.type === 'number') && !isNotesField(f)

/** Valor de texto tolerante: undefined/null → '' y number → string (drafts o respuestas de backend). */
const textLike = () =>
  z.preprocess(v => (v == null ? '' : typeof v === 'number' ? String(v) : v), z.string())

/**
 * Schema Zod dinámico para un Form step, con errores por campo.
 * - text / number: obligatorios salvo el campo de notas.
 * - number: si hay valor debe ser numérico.
 * - photo: al menos una foto entre todos los campos photo del form (error en el primero).
 * - button: sin valor.
 */
export function buildFieldsSchema(fields: readonly FormField[]) {
  const shape: Record<string, z.ZodType> = {}

  for (const f of fields) {
    const required = isFieldRequired(f)
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
        shape[f.id] = z.unknown()
        break
      case 'button':
        break
    }
  }

  const photoIds = fields.filter(f => f.type === 'photo').map(f => f.id)

  // loose: conserva claves no declaradas (no se pierden valores al enviar)
  return z.looseObject(shape).superRefine((values, ctx) => {
    const firstPhotoId = photoIds[0]
    if (!firstPhotoId) return
    const total = photoIds.reduce((acc, id) => acc + countPhotos(values[id]), 0)
    if (total === 0) {
      ctx.addIssue({ code: 'custom', message: PHOTO_REQUIRED_MESSAGE, path: [firstPhotoId] })
    }
  })
}
