import * as FileSystem from 'expo-file-system'

import { ensureWebImage } from './ensureWebImage'

export type PersistedPhoto = { id: string; uri: string; name: string; type: string }

/** Raíz de las fotos de auditorías. Vive en documentDirectory: iOS no la purga con poco espacio. */
export const PHOTOS_ROOT = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}kma/photos`
  : null

function newPhotoId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function isPersistedPhotoUri(uri: string): boolean {
  return !!PHOTOS_ROOT && uri.startsWith(`${PHOTOS_ROOT}/`)
}

/**
 * Convierte (HEIC → JPEG) y copia la foto a `documentDirectory/kma/photos/<groupId>/<photoId>.<ext>`.
 * `groupId` agrupa las fotos de una corrida/submission para poder borrarlas juntas.
 * Si no hay documentDirectory (web) devuelve la foto sin copiar.
 */
export async function persistPhoto(uri: string, groupId: string): Promise<PersistedPhoto> {
  const web = await ensureWebImage(uri)
  const id = newPhotoId()
  const ext = web.type === 'image/png' ? 'png' : 'jpg'
  const name = `${id}.${ext}`

  if (!PHOTOS_ROOT) return { id, uri: web.uri, name, type: web.type }

  const dir = `${PHOTOS_ROOT}/${groupId}`
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
  const dest = `${dir}/${name}`
  await FileSystem.copyAsync({ from: web.uri, to: dest })

  // La copia convertida (HEIC) queda en caché: ya no hace falta
  if (web.uri !== uri) await FileSystem.deleteAsync(web.uri, { idempotent: true }).catch(() => {})

  return { id, uri: dest, name, type: web.type }
}

/** Borra una foto persistida. Ignora URIs ajenas a `PHOTOS_ROOT`. */
export async function discardPhoto(uri: string): Promise<void> {
  if (!isPersistedPhotoUri(uri)) return
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true })
  } catch (err) {
    if (__DEV__) console.warn('[camera] No se pudo borrar la foto', uri, err)
  }
}

/** Borra el directorio completo de una corrida/submission. */
export async function discardPhotoGroup(groupId: string): Promise<void> {
  if (!PHOTOS_ROOT) return
  try {
    await FileSystem.deleteAsync(`${PHOTOS_ROOT}/${groupId}`, { idempotent: true })
  } catch (err) {
    if (__DEV__) console.warn('[camera] No se pudo borrar el directorio', groupId, err)
  }
}
