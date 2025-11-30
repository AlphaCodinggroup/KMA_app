import type { Project, ProjectId, ProjectsPage } from '@entities/project/model'
import type { ListProjectsParams, ProjectRepo } from '@entities/project/ports'
import type { Facility } from '@entities/facility/model'
import { createHttpProjectRepo } from './project.repo.http'
import { sqliteProjectRepo } from '@core/repos/sqliteProjectRepo'
import { sqliteFacilityRepo } from '@core/repos/sqliteFacilityRepo'
import { isOnlineOnce } from '@shared/lib/network'

/**
 * Repo offline-first para Projects:
 *
 * - Online:
 *    - delega en HTTP
 *    - actualiza cache SQLite (best-effort)
 * - Offline / error de red:
 *    - intenta leer desde SQLite
 */
class OfflineFirstProjectRepo implements ProjectRepo {
  private readonly httpRepo: ProjectRepo

  constructor() {
    this.httpRepo = createHttpProjectRepo()
  }

  /**
   * Listado de proyectos:
   * - Si hay conexión:
   *     - llama a la API
   *     - guarda/actualiza en SQLite (projects + facilities best-effort)
   *     - devuelve la página remota (respeta nextCursor, limit, etc.)
   * - Si NO hay conexión, o la API falla:
   *     - devuelve proyectos cacheados que matcheen status/search
   *       (sin paginación real: nextCursor = '', limit “dummy” para no romper contrato)
   */
  async list(params?: ListProjectsParams): Promise<ProjectsPage> {
    const isOnline = await isOnlineOnce()

    if (isOnline) {
      try {
        const page = await this.httpRepo.list(params)

        // Best-effort: cachear en SQLite, pero sin romper si falla
        try {
          // Cache de projects
          await sqliteProjectRepo.upsertMany(page.items)

          // Cache de facilities derivadas de cada project
          const facilitiesToUpsert: Facility[] = []

          for (const project of page.items) {
            if (!project.facilities || project.facilities.length === 0) continue

            for (const f of project.facilities) {
              facilitiesToUpsert.push({
                id: f.id,
                projectId: project.id,
                name: f.name,
                // El resto de campos de Facility quedan como undefined
              })
            }
          }

          if (facilitiesToUpsert.length > 0) {
            await sqliteFacilityRepo.upsertMany(facilitiesToUpsert)
          }
        } catch (err) {
          if (__DEV__) {
            // No es crítico: si falla el cache, seguimos devolviendo la data remota
            console.warn('[OfflineFirstProjectRepo.list] cache upsert failed', err)
          }
        }

        return page
      } catch (err) {
        // Si la API falla (timeout, red, 5xx...), intentamos fallback a cache
        if (__DEV__) {
          console.warn('[OfflineFirstProjectRepo.list] remote failed, using cache', err)
        }
        return this.listFromCache(params)
      }
    }

    // Sin conexión → vamos directo a cache
    return this.listFromCache(params)
  }

  /**
   * Detalle de proyecto:
   * - Online:
   *    - intenta remoto
   *    - cachea en SQLite (project + facilities mínimas)
   *    - si falla, intenta cache local
   * - Offline:
   *    - lee sólo desde cache
   *    - si no existe, lanza error
   */
  async getById(id: ProjectId): Promise<Project> {
    const isOnline = await isOnlineOnce()

    if (isOnline) {
      try {
        const project = await this.httpRepo.getById(id)

        // Cache best-effort
        try {
          // Cache de project
          await sqliteProjectRepo.upsertMany([project])

          // Cache de facilities asociadas (SOLUCIÓN)
          if (project.facilities && project.facilities.length > 0) {
            const facilities: Facility[] = project.facilities.map(f => ({
              id: f.id,
              projectId: project.id,
              name: f.name,
            }))
            await sqliteFacilityRepo.upsertMany(facilities)
          }
        } catch (err) {
          if (__DEV__) {
            console.warn('[OfflineFirstProjectRepo.getById] cache upsert failed', err)
          }
        }

        return project
      } catch (err) {
        if (__DEV__) {
          console.warn('[OfflineFirstProjectRepo.getById] remote failed, trying cache', id, err)
        }

        const cached = await sqliteProjectRepo.getById(id)
        if (cached) return cached

        // Si tampoco está en cache, propagamos el error original
        throw err
      }
    }

    // Sin conexión → sólo cache
    const cached = await sqliteProjectRepo.getById(id)
    if (cached) return cached

    throw new Error('Project not available offline')
  }

  // --------------------
  // Helpers internos
  // --------------------

  /**
   * Lee proyectos cacheados aplicando filtros básicos
   * y los empaqueta en un ProjectsPage "fake" (sin paginación remota real).
   */
  private async listFromCache(params?: ListProjectsParams): Promise<ProjectsPage> {
    const cached = await sqliteProjectRepo.listAll({
      // Mantengo el comportamiento que ya tenías: default ARCHIVED si no viene status
      status: params?.status,
      search: params?.search ?? '',
    })

    return {
      items: cached,
      limit: cached.length,
      nextCursor: '',
    }
  }
}

/**
 * Factory para wiring desde features/hooks.
 */
export const createOfflineFirstProjectRepo = (): ProjectRepo => new OfflineFirstProjectRepo()
