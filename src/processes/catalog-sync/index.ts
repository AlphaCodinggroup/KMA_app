import type { Project, ProjectId } from '@entities/project/model'
import type { Facility } from '@entities/facility/model'
import { createHttpProjectRepo } from '@features/projects/data/project.repo.http'
import { createHttpFacilityRepo } from '@features/facility/data/facility.repo.http'
import { sqliteProjectRepo } from '@core/repos/sqliteProjectRepo'
import { sqliteFacilityRepo } from '@core/repos/sqliteFacilityRepo'
import { isOnlineOnce } from '@shared/lib/network'
import { coldSyncAllFlows } from '@features/selector/application/usecases'

/**
 * Estado interno para evitar syncs concurrentes o demasiado frecuentes.
 */
let catalogsSyncPromise: Promise<void> | null = null
let lastCatalogSyncAt = 0
const CATALOG_SYNC_COOLDOWN_MS = 60_000 // 1 minuto de ventana mínima entre syncs "globales"

/**
 * Sincroniza el catálogo de Flows:
 * - Si hay red:
 *    - usa el FlowRepo offline-first (HTTP + SQLite)
 *    - trae todos los flows y actualiza catálogo + steps en SQLite (saveCatalog + saveFlowDetail)
 *    - además, via coldSyncAllFlows, dispara la precarga de imágenes de steps.
 * - Si NO hay red o falla la API:
 *    - loggea en dev y no rompe nada
 */
export async function syncFlowsCatalog(): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  try {
    await coldSyncAllFlows()
  } catch (err) {
    if (__DEV__) {
      console.warn('[catalog-sync] syncFlowsCatalog failed', err)
    }
  }
}

/**
 * Sincroniza el catálogo completo de Projects:
 *
 * - Usa SIEMPRE el repo HTTP (fuente de verdad).
 * - Pagina hasta agotar `nextCursor`.
 * - Al final hace `replaceAll` en SQLite para:
 *    - agregar nuevos
 *    - actualizar existentes
 *    - eliminar los que ya no vienen del backend
 */
export async function syncProjectsCatalog(): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  const httpRepo = createHttpProjectRepo()

  try {
    const all: Project[] = []
    let cursor: string | undefined = undefined

    // Paginación por cursor hasta agotar resultados
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await httpRepo.list({ cursor })
      all.push(...page.items)

      if (!page.nextCursor) break
      cursor = page.nextCursor
    }

    await sqliteProjectRepo.replaceAll(all)
  } catch (err) {
    if (__DEV__) {
      console.warn('[catalog-sync] syncProjectsCatalog failed', err)
    }
  }
}

/**
 * Sincroniza las Facilities de un proyecto puntual.
 *
 * - Usa repo HTTP para recorrer todas las páginas de ese proyecto.
 * - Actualiza SQLite con `replaceAllForProject(projectId, items)`.
 */
export async function syncFacilitiesForProject(projectId: ProjectId): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  const httpRepo = createHttpFacilityRepo()

  try {
    const all: Facility[] = []
    let cursor: string | undefined = undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await httpRepo.listByProject(projectId, { cursor })
      all.push(...page.items)

      if (!page.nextCursor) break
      cursor = page.nextCursor
    }

    await sqliteFacilityRepo.replaceAllForProject(projectId, all)
  } catch (err) {
    if (__DEV__) {
      console.warn('[catalog-sync] syncFacilitiesForProject failed', { projectId, err })
    }
  }
}

/**
 * Sincroniza facilities para TODOS los proyectos conocidos en SQLite.
 *
 * - Lee proyectos desde sqliteProjectRepo (cualquier estado).
 * - Para cada uno llama a syncFacilitiesForProject de forma secuencial
 *   para no saturar la API.
 */
export async function syncFacilitiesForAllProjects(): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  try {
    const projects: Project[] = await sqliteProjectRepo.listAll({})

    for (const project of projects) {
      if (!project.id) continue
      // Secuencial para no hacer spam al backend.
      // eslint-disable-next-line no-await-in-loop
      await syncFacilitiesForProject(project.id)
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[catalog-sync] syncFacilitiesForAllProjects failed', err)
    }
  }
}

/**
 * Punto de entrada de alto nivel:
 * - Projects
 * - Flows (catálogo + steps + precarga de imágenes)
 * - Facilities (para todos los proyectos cacheados)
 *
 * Además:
 * - Evita ejecuciones concurrentes (re-uso de la misma Promise).
 * - Aplica un cooldown mínimo entre syncs "globales" para no spamear la API
 *   cuando hay muchos eventos de AppState / NetInfo / sesión.
 */
export async function syncAllCatalogs(): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  // Si ya hay un sync en curso, devolvemos ese mismo promise
  if (catalogsSyncPromise) return catalogsSyncPromise

  const now = Date.now()

  // Si se llamó hace muy poco, salimos silenciosamente (cooldown)
  if (now - lastCatalogSyncAt < CATALOG_SYNC_COOLDOWN_MS) return

  catalogsSyncPromise = (async () => {
    try {
      await syncProjectsCatalog()
      await syncFlowsCatalog()
      await syncFacilitiesForAllProjects()
    } finally {
      lastCatalogSyncAt = Date.now()
      catalogsSyncPromise = null
    }
  })()

  return catalogsSyncPromise
}
