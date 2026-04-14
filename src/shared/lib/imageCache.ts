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
const warnedUnsupportedUrls = new Set<string>()

function getUriScheme(url: string): string | null {
  const match = url.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  return match ? match[1].toLowerCase() : null
}

function warnUnsupportedUrlOnce(url: string, reason: string): void {
  if (!__DEV__) return
  const key = `${reason}::${url}`
  if (warnedUnsupportedUrls.has(key)) return

  warnedUnsupportedUrls.add(key)
  console.warn('[imageCache] skipping unsupported image URL', { reason, url })
}

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
 * - Usa un hash estable de la URL "normalizada" para evitar colisiones.
 * - Conserva parte del basename para debugging humano.
 * - Evita por completo `/`, `:`, `#`, `?` y otros caracteres problemáticos.
 *
 * Nota: no usamos la URL cruda como filename porque en Android ciertos caracteres
 * percent-encoded pueden terminar re-interpretándose como separadores de path.
 */
function stripUrlDecorators(url: string): string {
  const trimmed = url.trim()

  let end = trimmed.length
  const queryIdx = trimmed.indexOf('?')
  const hashIdx = trimmed.indexOf('#')

  if (queryIdx >= 0 && queryIdx < end) end = queryIdx
  if (hashIdx >= 0 && hashIdx < end) end = hashIdx

  return trimmed.slice(0, end)
}

function getUrlBasename(url: string): string {
  const normalized = stripUrlDecorators(url)
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? 'image'
}

function getFilenameExtension(name: string): string {
  const match = name.match(/(\.[a-zA-Z0-9]{1,10})$/)
  return match ? match[1].toLowerCase() : ''
}

function sanitizeFilenamePart(value: string): string {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^\.+/g, '')

  if (!sanitized) return 'image'
  return sanitized.slice(0, 80)
}

function hashString(value: string): string {
  // FNV-1a 32-bit: simple, estable y suficientemente bueno para cache keys locales.
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getFilenameFromUrl(url: string): string {
  const normalized = stripUrlDecorators(url)
  const basename = getUrlBasename(normalized)
  const extension = getFilenameExtension(basename)
  const basenameWithoutExtension = extension ? basename.slice(0, -extension.length) : basename
  const safeBasename = sanitizeFilenamePart(basenameWithoutExtension)
  const hash = hashString(normalized)

  return `flow_${hash}_${safeBasename}${extension}`
}

function getLegacyFilenameFromUrl(url: string): string {
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

function buildLegacyLocalUri(url: string): string | null {
  if (!FLOW_IMAGES_DIR) return null
  const filename = getLegacyFilenameFromUrl(url)
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

  const scheme = getUriScheme(url)

  // Sólo cacheamos recursos remotos reales. Otros esquemas se devuelven tal cual
  // o se ignoran si no son utilizables en native.
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    if (scheme === 'blob') {
      warnUnsupportedUrlOnce(url, 'blob URLs are browser-scoped and cannot be downloaded on native')
      return undefined
    }

    return url
  }

  // Si no tenemos documentDirectory (por ejemplo, en web), devolvemos la URL remota
  if (!FLOW_IMAGES_DIR) {
    return url
  }

  const localUri = buildLocalUri(url)
  if (!localUri) return url
  const legacyLocalUri = buildLegacyLocalUri(url)

  try {
    await ensureDirExists()

    // Compatibilidad: primero revisamos el esquema nuevo y luego el legacy.
    const candidateUris = Array.from(
      new Set([localUri, legacyLocalUri].filter((value): value is string => !!value)),
    )

    for (const candidateUri of candidateUris) {
      const info = await FileSystem.getInfoAsync(candidateUri)
      if (info.exists) {
        return candidateUri
      }
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
