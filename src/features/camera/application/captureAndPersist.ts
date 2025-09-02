import * as FileSystem from 'expo-file-system'
import type { CameraCapturedPicture } from 'expo-camera'
import { v4 as uuidv4 } from 'uuid'

/**
 * Persiste una foto en `FileSystem.documentDirectory/photos` con nombre aleatorio.
 * Crea la carpeta si no existe y copia el archivo desde `photo.uri`.
 *
 * @async
 * @param {CameraCapturedPicture} photo - Objeto devuelto por `expo-camera` tras capturar.
 * @returns {Promise<{ id: string; path: string }>} Identificador del archivo y ruta absoluta dentro del sandbox de la app.
 * @throws {Error} Si falla la copia del archivo (`copyAsync`).
 * @remarks
 * - El directorio de destino es privado a la app (no aparece en la galería del sistema).
 * - Para publicar en la galería del usuario, usar APIs específicas (no cubierto aquí).
 */
export async function persistPhotoToAppStorage(photo: CameraCapturedPicture) {
  const id = uuidv4()
  const dir = `${FileSystem.documentDirectory}photos`
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {})
  const dest = `${dir}/${id}.jpg`
  await FileSystem.copyAsync({ from: photo.uri, to: dest })
  return { id, path: dest }
}
