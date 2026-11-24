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

/** Nombre del archivo local (sin query), p. ej. `abc123.jpg`. */
function fileNameOf(localUri: string): string {
  return localUri.split('?')[0]?.split('/').pop() ?? ''
}

/** Id de una foto: nombre base de su archivo local (sin query ni extensión). */
export function photoIdFromUri(localUri: string): string {
  const file = fileNameOf(localUri)
  const dot = file.lastIndexOf('.')
  return (dot > 0 ? file.slice(0, dot) : file) || 'photo'
}

/**
 * Id de la fila de `photo_uploads` (y del item `PHOTO_UPLOAD`). Incluye la submission: dos auditorías
 * pueden tener archivos con el mismo nombre (p. ej. `IMG_0001` migrado de la caché de la 1.0.8).
 */
export function photoRowId(submissionId: string, localUri: string): string {
  return `${submissionId}__${photoIdFromUri(localUri)}`
}

/**
 * Nombre de subida estable: `<stepId>_<fieldId>_<photoId>.<ext>` (BE-5).
 * `photoId` sale del nombre del archivo local (único por foto, lo genera `persistPhoto`), así que
 * reintentar un envío reutiliza el mismo nombre y no depende del orden del array ni de la hora.
 */
export function photoUploadName(stepId: string, fieldId: string, localUri: string): string {
  const file = fileNameOf(localUri)
  const dot = file.lastIndexOf('.')
  const ext = (dot > 0 ? file.slice(dot + 1) : 'jpg').toLowerCase() || 'jpg'
  return `${stepId}_${fieldId}_${photoIdFromUri(localUri)}.${ext}`
}

export function isLocalFileUri(uri: string): boolean {
  return uri.startsWith('file')
}
