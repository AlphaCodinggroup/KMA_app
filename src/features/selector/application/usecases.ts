import type { FlowSummary, Flow } from '@entities/flow/model'
import type { FlowRepo } from '@entities/flow/ports'
import { createOfflineFirstFlowRepo } from '../data/flow.repo.offline'
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
 * Carga todos los flows completos (incluye steps).
 * Además de usar el repo offline-first, dispara en segundo plano
 * la precarga de imágenes de los steps para uso offline.
 */
export async function loadAllFlowsWithSteps(): Promise<Flow[]> {
  const repo = getFlowRepo()
  const flows = await repo.getAll()

  // Fire-and-forget: precarga de imágenes sin bloquear la UI
  void precacheFlowImages(flows).catch(err => {
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
 * - Online:
 *    - repo.getAll() forza fetch remoto + cache en SQLite (flows + steps).
 *    - precacheFlowImages() descarga y cachea imágenes (S3 → file://) best-effort.
 * - Offline:
 *    - repo.getAll() reconstruye desde SQLite.
 *    - precacheFlowImages() no rompe: si no puede resolver/descargar, se ignora.
 */
export async function coldSyncAllFlows(): Promise<void> {
  const repo = getFlowRepo()
  const flows = await repo.getAll()
  if (!flows.length) return

  await precacheFlowImages(flows)
}

// -----------------------------------------------------------------------------
// Helpers internos para precarga de imágenes de flows
// -----------------------------------------------------------------------------

/**
 * Extrae todas las URLs de imagen de los steps de un flow.
 * Usa solo la propiedad `image` que ya está en el dominio.
 */
function extractFlowImageUrls(flow: Flow): string[] {
  const urls: string[] = []

  for (const step of flow.steps as any[]) {
    const maybeUrl = step?.image
    if (typeof maybeUrl !== 'string') continue

    const trimmed = maybeUrl.trim()
    if (!trimmed) continue

    urls.push(trimmed)
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
