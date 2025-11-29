import * as FileSystem from 'expo-file-system'
import { isOnlineOnce } from '@shared/lib/network'

/**
 * Directorio donde cacheamos las imágenes de los flows.
 * Usamos documentDirectory para que persistan entre sesiones.
 */
const FLOW_IMAGES_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}flow-images`
  : null

let dirEnsured = false

async function ensureDirExists(): Promise<void> {
  if (!FLOW_IMAGES_DIR) return
  if (dirEnsured) return

  try {
    const info = await FileSystem.getInfoAsync(FLOW_IMAGES_DIR)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(FLOW_IMAGES_DIR, { intermediates: true })
    }
  } catch (e) {
    if (__DEV__) {
      // Best-effort: si falla, no rompemos el flujo
      console.warn('[imageCache] ensureDirExists failed', e)
    }
  } finally {
    dirEnsured = true
  }
}

/**
 * Genera un nombre de archivo determinista a partir de la URL remota.
 * - encodeURIComponent evita caracteres raros en el path.
 * - Quitamos querystring para que el mismo recurso no genere múltiples archivos.
 */
function getFilenameFromUrl(url: string): string {
  const [base] = url.split('?')
  return encodeURIComponent(base)
}

/**
 * Devuelve la uri local esperada para una URL dada (sin chequear existencia).
 */
function buildLocalUri(url: string): string | null {
  if (!FLOW_IMAGES_DIR) return null
  const filename = getFilenameFromUrl(url)
  return `${FLOW_IMAGES_DIR}/${filename}`
}

/**
 * Resuelve una URL de imagen de flow a una uri “óptima”:
 *  - Si ya está cacheada en disco → devuelve `file://...`
 *  - Si no está cacheada y hay red → intenta descargarla, cachearla y devuelve `file://...`
 *  - Si falla la descarga o no hay directorio disponible → devuelve la URL remota original
 *
 * Importante:
 *  - En modo offline, si la imagen NO estuvo cacheada antes, no hay forma de mostrarla.
 *    En ese caso se devuelve la URL remota, que el <Image> no podrá cargar sin red,
 *    pero no se rompe ningún flujo.
 */
export async function resolveFlowImageUri(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined

  // Si no tenemos documentDirectory (por ejemplo, en web), devolvemos la URL remota
  if (!FLOW_IMAGES_DIR) {
    return url
  }

  const localUri = buildLocalUri(url)
  if (!localUri) return url

  try {
    await ensureDirExists()

    // Si ya existe en disco, usamos directamente el file://
    const info = await FileSystem.getInfoAsync(localUri)
    if (info.exists) {
      return localUri
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[imageCache] getInfoAsync failed', e)
    }
    // Si falla el getInfo, seguimos abajo e intentamos descarga
  }

  // Si no existe aún, vemos si hay conectividad antes de intentar descargar
  const online = await isOnlineOnce()
  if (!online) {
    // Sin red y sin cache previo → devolvemos la URL remota
    // (no se va a poder cargar, pero no rompemos nada).
    return url
  }

  try {
    await ensureDirExists()
    await FileSystem.downloadAsync(url, localUri)
    return localUri
  } catch (e) {
    if (__DEV__) {
      console.warn('[imageCache] downloadAsync failed', url, e)
    }
    // Fallback: usamos la URL remota (online seguirá funcionando como hasta ahora).
    return url
  }
}

/**
 * Helper opcional para precache explícito de una imagen.
 * Es simplemente un alias semántico de resolveFlowImageUri.
 * Puede usarse, por ejemplo, durante un "cold sync" de flows.
 */
export async function precacheFlowImage(url?: string | null): Promise<void> {
  if (!url) return
  try {
    await resolveFlowImageUri(url)
  } catch (e) {
    if (__DEV__) {
      console.warn('[imageCache] precacheFlowImage failed', url, e)
    }
  }
}

/**
 * Precache en batch una lista de URLs de imágenes de steps.
 * - Deduplica URLs.
 * - Usa concurrencia moderada para no saturar la red.
 * - No lanza si alguna falla; solo loguea en dev.
 */
export async function precacheFlowImages(urls: Array<string | null | undefined>): Promise<void> {
  const unique = Array.from(
    new Set(
      urls
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map(u => u.trim()),
    ),
  )

  if (!unique.length) return

  const CONCURRENCY = 4
  const queue = [...unique]

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const url = queue.shift()
      if (!url) return

      try {
        await resolveFlowImageUri(url)
      } catch (e) {
        if (__DEV__) {
          console.warn('[imageCache] precacheFlowImages failed', url, e)
        }
        // En producción ignoramos; la UI seguirá usando el comportamiento normal.
      }
    }
  })

  await Promise.all(workers)
}
