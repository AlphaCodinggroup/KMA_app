/**
 * Helpers puros para leer las fotos de las respuestas `Form` de una submission.
 * Las fotos viven en `values.photos` (o `values.photo` en datos viejos) como string de URI
 * o como objeto con `uri` / `localUri` / `url`.
 */

export const PHOTO_FIELD_KEYS = ['photos', 'photo'] as const

export type PhotoValueObject = {
  uri?: string
  localUri?: string
  url?: string
  name?: string
  fileName?: string
  filename?: string
  type?: string
  [key: string]: unknown
}

export type PhotoValue = string | PhotoValueObject

/** Clave donde viven las fotos de un `values` (`photos` por defecto). */
export function photoFieldKey(values: Record<string, unknown> | null | undefined): string {
  const v = values ?? {}
  return PHOTO_FIELD_KEYS.find(k => Array.isArray(v[k])) ?? 'photos'
}

/** Fotos de un `values`, tomadas de `photos` y, si no hay, de `photo`. */
export function extractPhotoArray(values: Record<string, unknown> | null | undefined): unknown[] {
  const v = values ?? {}
  if (Array.isArray(v.photos)) return v.photos
  if (Array.isArray(v.photo)) return v.photo
  return []
}

/** URI de una foto (string u objeto), o '' si no tiene. */
export function photoUriOf(p: unknown): string {
  if (typeof p === 'string') return p
  if (!p || typeof p !== 'object') return ''
  const v = p as PhotoValueObject
  return v.uri || v.localUri || v.url || ''
}

/** Reemplaza la URI de una foto conservando el resto de sus campos. */
export function withPhotoUri(p: PhotoValue, uri: string): PhotoValue {
  if (typeof p === 'string') return uri
  const out: PhotoValueObject = { ...p }
  for (const k of ['uri', 'localUri', 'url'] as const) {
    if (typeof out[k] === 'string') out[k] = uri
  }
  return out
}

export function isLocalFileUri(uri: string): boolean {
  return uri.startsWith('file')
}
