import type { Project, ProjectId } from '@entities/project/model'
import type { Facility } from '@entities/facility/model'
import { createHttpProjectRepo } from '@features/projects/data/project.repo.http'
import { createHttpFacilityRepo } from '@features/facility/data/facility.repo.http'
import { sqliteProjectRepo } from '@core/repos/sqliteProjectRepo'
import { sqliteFacilityRepo } from '@core/repos/sqliteFacilityRepo'
import { isOnlineOnce } from '@shared/lib/network'
import { coldSyncAllFlows } from '@features/selector/application/usecases'
import type { CompletedAudit } from '@entities/audit/model'
import { isAuditInProgress } from '@entities/audit/lib/status'
import { createHttpAuditRepo } from '@features/audits/data/audit.repo.http'
import { sqliteAuditRepo } from '@core/repos/sqliteAuditRepo'
import { getCurrentUserId } from '@shared/session/session'

/**
 * Estado interno para evitar syncs concurrentes o demasiado frecuentes.
 */
let catalogsSyncPromise: Promise<void> | null = null
let lastCatalogSyncAt = 0
const CATALOG_SYNC_COOLDOWN_MS = 60_000 // 1 minuto de ventana mínima entre syncs "globales"

let auditsSyncPromise: Promise<void> | null = null
/** Dueño de la corrida en vuelo y del último sync: otra cuenta no reutiliza ni hereda el cooldown. */
let auditsSyncUserId: string | null = null
let lastAuditsSyncAt = 0
const AUDITS_PAGE_LIMIT = 50
// Tope de páginas.
const AUDITS_MAX_PAGES = 10

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

    const facilitiesFromProjects: Facility[] = all.flatMap(project =>
      (project.facilities ?? []).map(facility => ({
        id: facility.id,
        projectId: project.id,
        name: facility.name,
      })),
    )

    if (facilitiesFromProjects.length > 0) {
      await sqliteFacilityRepo.upsertMany(facilitiesFromProjects)
    }
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
 * Sincroniza las auditorías enviadas del auditor hacia la cache local.
 *
 * - Filtra por `auditor` = `sub` del idToken; el filtro por facility se hace al leer.
 * - Pagina con `last_eval_id` hasta `AUDITS_MAX_PAGES`; los borradores en curso se omiten
 *   (viven en `submissions`).
 * - Sólo poda lo que ya no existe en el backend si se leyeron todas las páginas.
 * - Cooldown de 60 s y promise compartida; `force` salta el cooldown (pull-to-refresh).
 */
export async function syncCompletedAudits(opts: { force?: boolean } = {}): Promise<void> {
  const online = await isOnlineOnce()
  if (!online) return

  // El backend guarda `created_by` = `sub` de Cognito y el filtro `auditor` coincide con ese valor
  // (con el email devuelve vacío). Por eso el usuario es a la vez dueño del cache y filtro.
  const userId = getCurrentUserId()
  if (!userId) return
  const auditor = userId

  if (auditsSyncPromise) {
    if (auditsSyncUserId === userId) return auditsSyncPromise
    // Corrida de otra cuenta: se espera y se sincroniza la actual
    await auditsSyncPromise
    if (auditsSyncPromise) return auditsSyncPromise
  }
  if (
    !opts.force &&
    auditsSyncUserId === userId &&
    Date.now() - lastAuditsSyncAt < CATALOG_SYNC_COOLDOWN_MS
  ) {
    return
  }

  auditsSyncUserId = userId
  auditsSyncPromise = (async () => {
    try {
      const httpRepo = createHttpAuditRepo()
      const all: CompletedAudit[] = []
      let lastEvalId: string | undefined
      let complete = false

      for (let page = 0; page < AUDITS_MAX_PAGES; page++) {
        const res = await httpRepo.list({ auditor, limit: AUDITS_PAGE_LIMIT, lastEvalId })
        all.push(...res.items.filter(a => !isAuditInProgress(a.status)))
        if (!res.lastEvalId) {
          complete = true
          break
        }
        lastEvalId = res.lastEvalId
      }

      await sqliteAuditRepo.upsertList(userId, all, { prune: complete })
      lastAuditsSyncAt = Date.now()
    } catch (err) {
      if (__DEV__) console.warn('[catalog-sync] syncCompletedAudits failed', err)
    } finally {
      auditsSyncPromise = null
    }
  })()

  return auditsSyncPromise
}

/**
 * Punto de entrada de alto nivel:
 * - Projects
 * - Flows (catálogo + steps + precarga de imágenes)
 * - Facilities (para todos los proyectos cacheados)
 * - Auditorías enviadas del auditor
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
      // Completados es independiente de los catálogos: corre en paralelo y no depende de que ellos anden
      const [catalogs] = await Promise.allSettled([
        (async () => {
          await syncProjectsCatalog()
          await syncFlowsCatalog()
          await syncFacilitiesForAllProjects()
        })(),
        syncCompletedAudits(),
      ])
      if (catalogs.status === 'rejected') throw catalogs.reason
    } finally {
      lastCatalogSyncAt = Date.now()
      catalogsSyncPromise = null
    }
  })()

  return catalogsSyncPromise
}
