import { z } from 'zod'

/**
 * Props opcionales que backend va incorporando de forma gradual (BE-12). Son tolerantes a
 * propósito: un valor ausente, `null` o de tipo inesperado se lee como `undefined` en vez de
 * invalidar el flow completo (y con él, el catálogo cacheado de ese flow).
 */
export const lenientBoolean = z.boolean().optional().catch(undefined)

/** Acepta number o string numérico ("2"); cualquier otra cosa (null, NaN, "abc") → undefined. */
export const lenientNumber = z
  .preprocess(
    v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
    z.number().finite().optional(),
  )
  .catch(undefined)
