import type { SubmissionAnswer } from '@entities/submission/model'
import type { PhotoUpload } from '@entities/photo/model'
import { extractPhotoArray, photoUriOf } from '@entities/submission/lib/photos'

/**
 * Helpers puros para saber si las fotos de una respuesta ya están en S3. Las respuestas conservan
 * la URI local (`file://`); al armar un delta se reemplaza por el `file_url` de la subida.
 */

/** URIs locales (`file…`) de las fotos de una respuesta `Form`. */
export function localPhotoUris(answer: SubmissionAnswer | undefined): string[] {
  if (!answer || answer.type !== 'Form') return []
  return extractPhotoArray(answer.values)
    .map(photoUriOf)
    .filter(uri => uri.startsWith('file'))
}

export function indexByLocalUri(rows: readonly PhotoUpload[]): Map<string, PhotoUpload> {
  return new Map(rows.map(row => [row.localUri, row]))
}

const isUploaded = (row: PhotoUpload | undefined): boolean =>
  row?.status === 'uploaded' && !!row.remoteUrl

/**
 * ¿Falta subir alguna foto de la respuesta? Una foto local sin fila en `photo_uploads` también
 * cuenta como pendiente (no hay forma de enviarla).
 */
export function hasUnuploadedPhotos(
  answer: SubmissionAnswer | undefined,
  byLocalUri: ReadonlyMap<string, PhotoUpload>,
): boolean {
  return localPhotoUris(answer).some(uri => !isUploaded(byLocalUri.get(uri)))
}

/** `uploadName → file_url` de las fotos ya subidas (insumo de `buildAnswersForApi`). */
export function buildUploadMap(rows: readonly PhotoUpload[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    if (isUploaded(row) && row.remoteUrl) map[row.uploadName] = row.remoteUrl
  }
  return map
}
