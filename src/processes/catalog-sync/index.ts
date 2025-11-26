import type { Project } from '@entities/project/model'
import type { ProjectId } from '@entities/project/model'
import type { FlowRepo } from '@entities/flow/ports'
import type { Facility } from '@entities/facility/model'
import { createOfflineFirstFlowRepo } from '@features/selector/data/flow.repo.offline'
import { createHttpProjectRepo } from '@features/projects/data/project.repo.http'
import { createHttpFacilityRepo } from '@features/facility/data/facility.repo.http'
import { sqliteProjectRepo } from '@core/repos/sqliteProjectRepo'
import { sqliteFacilityRepo } from '@core/repos/sqliteFacilityRepo'
import { isOnlineOnce } from '@shared/lib/network'

/**
 * Sincroniza el catálogo de Flows:
 * - Si hay red:
 *    - usa el FlowRepo offline-first (HTTP + SQLite)
 *    - trae todos los flows y actualiza catálogo + steps en SQLite (saveCatalog + saveFlowDetail)
 * - Si NO hay red o falla la API:
 *    - loggea en dev y no rompe nada
 */
export async function syncFlowsCatalog(): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  const repo: FlowRepo = createOfflineFirstFlowRepo()

  try {
    // getAll() ya se encarga de:
    //  - llamar a la API,
    //  - cachear catálogo + detalle en SQLite,
    //  - y hacer prune vía saveCatalog.
    await repo.getAll()
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
    // Si la API no usa paginación, nextCursor vendrá vacío y sale en una vuelta.
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
    // Obtenemos todos los proyectos cacheados.
    // listAll({}) debería devolver todos sin filtrar por status/search.
    const projects: Project[] = await sqliteProjectRepo.listAll({})

    for (const project of projects) {
      // Si por alguna razón no hay id, lo salteamos defensivamente.
      if (!project.id) continue
      // Secuencial para no hacer spam al backend.
      // Si quisieras paralelizar, usarías Promise.allSettled con un throttle.
      // Pero para mobile + offline-first, secuencial es más seguro.
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
 * - Flows
 * - Projects
 * - Facilities (para todos los proyectos cacheados)
 *
 * Pensado para ser llamado desde:
 *  - bootstrap (al arrancar la app con red)
 *  - workers de background/foreground cuando vuelve la conectividad
 */
export async function syncAllCatalogs(): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  // En paralelo lo que no tiene dependencia entre sí
  await Promise.allSettled([syncFlowsCatalog(), syncProjectsCatalog()])

  // Facilities dependen de tener los proyectos en SQLite.
  await syncFacilitiesForAllProjects()
}
