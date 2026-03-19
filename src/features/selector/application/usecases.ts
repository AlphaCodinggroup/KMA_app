import type { FlowSummary, Flow } from '@entities/flow/model'
import type { FlowRepo } from '@entities/flow/ports'
import { createOfflineFirstFlowRepo } from '../data/flow.repo.offline'
import { resolveStepImageUrls } from '@shared/lib/flowStepImages'
import { resolveFlowImageUri } from '@shared/lib/imageCache'

/**
 * Singleton muy simple para no instanciar el repo en cada llamada.
 */
let flowRepoInstance: FlowRepo | null = null

const getFlowRepo = (): FlowRepo => {
  if (!flowRepoInstance) {
    flowRepoInstance = createOfflineFirstFlowRepo()
  }
  return flowRepoInstance
}

/**
 * Gate global para evitar múltiples getAll() concurrentes hacia /flows.
 * - Si ya hay una carga en curso, todos los callers reutilizan la misma Promise.
 */
let inflightAllFlowsPromise: Promise<Flow[]> | null = null

/**
 * Helper interno: obtiene todos los flows usando el repo offline-first,
 * garantizando que sólo haya un getAll() activo a la vez.
 *
 * - Online: pega a la API, sincroniza SQLite (catálogo + steps).
 * - Offline / error de red: reconstruye desde SQLite.
 */
async function fetchAllFlowsOnce(): Promise<Flow[]> {
  if (inflightAllFlowsPromise) {
    return inflightAllFlowsPromise
  }

  const repo = getFlowRepo()

  inflightAllFlowsPromise = (async () => {
    const flows = await repo.getAll()
    return flows
  })()

  try {
    return await inflightAllFlowsPromise
  } finally {
    // Siempre liberamos el gate al completar (éxito o error),
    // para permitir una futura recarga explícita.
    inflightAllFlowsPromise = null
  }
}

/**
 * Carga todos los flows completos (incluye steps).
 * Además de usar el repo offline-first, dispara en segundo plano
 * la precarga de imágenes de los steps para uso offline.
 *
 * - Si otra parte de la app ya está cargando flows, se reutiliza la misma Promise.
 */
export async function loadAllFlowsWithSteps(): Promise<Flow[]> {
  const flows = await fetchAllFlowsOnce()

  // Fire-and-forget: precarga de imágenes sin bloquear la UI
  precacheFlowImages(flows).catch(err => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[loadAllFlowsWithSteps] precacheFlowImages failed', err)
    }
  })

  return flows
}

/**
 * Carga el catálogo resumido para las tarjetas del Selector.
 * Usa directamente getSummaries() del repo offline-first, que:
 *  - Online: pide a la API, cachea en SQLite y aplica filtros/paginación.
 *  - Offline: lee solo desde la base local.
 */
export async function loadCatalog(): Promise<FlowSummary[]> {
  const repo = getFlowRepo()
  return repo.getSummaries()
}

/**
 * Sincronización en frío (hook para procesos cross-feature / bootstrap).
 *
 * - Reutiliza el mismo gate de fetchAllFlowsOnce:
 *    - Si otra parte ya está pidiendo todos los flows, comparte el mismo getAll().
 * - Luego hace una pasada adicional de precarga de imágenes, pero:
 *    - Deduplica URLs.
 *    - Usa resolveFlowImageUri (que es idempotente a nivel de archivo local).
 */
export async function coldSyncAllFlows(): Promise<void> {
  const flows = await fetchAllFlowsOnce()
  if (!flows.length) return

  await precacheFlowImages(flows)
}

// -----------------------------------------------------------------------------
// Helpers internos para precarga de imágenes de flows
// -----------------------------------------------------------------------------

/**
 * Extrae todas las URLs de imagen de los steps de un flow.
 * Prioriza `images` y, si no hay valores válidos, cae a `image`.
 */
function extractFlowImageUrls(flow: Flow): string[] {
  const urls: string[] = []

  for (const step of flow.steps) {
    urls.push(...resolveStepImageUrls(step))
  }

  return urls
}

/**
 * Precarga imágenes de una lista de flows:
 *  - Deduplica URLs.
 *  - Usa resolveFlowImageUri, que:
 *      - Si ya está en caché → devuelve file://...
 *      - Si no está y hay red → la descarga y guarda.
 *  - Maneja errores de forma silenciosa (solo log en dev).
 */
async function precacheFlowImages(flows: Flow[]): Promise<void> {
  const urlSet = new Set<string>()

  for (const flow of flows) {
    for (const url of extractFlowImageUrls(flow)) {
      urlSet.add(url)
    }
  }

  const urls = Array.from(urlSet)
  if (!urls.length) return

  const CONCURRENCY = 4
  const queue = [...urls]

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const url = queue.shift()
      if (!url) return

      try {
        await resolveFlowImageUri(url)
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[precacheFlowImages] failed for url', url, err)
        }
        // En prod: ignoramos; el runner seguirá resolviendo on-demand.
      }
    }
  })

  await Promise.all(workers)
}
