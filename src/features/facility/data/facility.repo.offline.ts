import type { Facility, FacilityId, ProjectId, FacilitiesPage } from '@entities/facility/model'
import type { FacilityRepo, ListFacilitiesParams } from '@entities/facility/ports'
import { createHttpFacilityRepo } from './facility.repo.http'
import { sqliteFacilityRepo } from '@core/repos/sqliteFacilityRepo'
import { isOnlineOnce } from '@shared/lib/network'

/**
 * Repo offline-first para Facilities.
 * Estrategia:
 *  - Online:
 *      - delega en HTTP
 *      - actualiza cache SQLite (replace / upsert)
 *  - Offline o error de red:
 *      - usa solo la cache SQLite
 */
class OfflineFirstFacilityRepo implements FacilityRepo {
  private readonly httpRepo: FacilityRepo

  constructor() {
    this.httpRepo = createHttpFacilityRepo()
  }

  /**
   * Lista facilities por proyecto.
   *
   * Online:
   *   Llama a la API (HTTP repo).
   *   Reemplaza el cache local de ese proyecto en SQLite.
   *   Devuelve la página remota (FacilitiesPage).
   *
   * Offline o error:
   *  - Devuelve una FacilitiesPage "fake" armada desde SQLite
   *    (sin paginación real: nextCursor = '').
   */
  async listByProject(
    projectId: ProjectId,
    params?: ListFacilitiesParams,
  ): Promise<FacilitiesPage> {
    const online = await isOnlineOnce()

    if (online) {
      try {
        const page = await this.httpRepo.listByProject(projectId, params)

        // Best-effort: actualizamos cache local para ese proyecto
        try {
          await sqliteFacilityRepo.replaceAllForProject(projectId, page.items)
        } catch (err) {
          if (__DEV__) {
            console.warn('[OfflineFirstFacilityRepo.listByProject] cache replace failed', err)
          }
        }

        return page
      } catch (err) {
        if (__DEV__) {
          console.warn('[OfflineFirstFacilityRepo.listByProject] remote failed, using cache', err)
        }
        return this.listFromCache(projectId, params)
      }
    }

    // Sin conexión → sólo cache
    return this.listFromCache(projectId, params)
  }

  /**
   * Detalle de una facility.
   *
   * Online:
   *  - Intenta traer desde API.
   *  - Si llega, hace upsert en SQLite y devuelve la facility.
   *  - Si falla la API, intenta leer desde cache por facilityId.
   *
   * Offline:
   *  - Lee desde cache.
   *  - Si no existe, lanza error (para cumplir FacilityRepo).
   */
  async getById(projectId: ProjectId, facilityId: FacilityId): Promise<Facility> {
    const online = await isOnlineOnce()

    if (online) {
      try {
        const facility = await this.httpRepo.getById(projectId, facilityId)

        try {
          await sqliteFacilityRepo.upsertMany([facility])
        } catch (err) {
          if (__DEV__) {
            console.warn('[OfflineFirstFacilityRepo.getById] cache upsert failed', err)
          }
        }

        return facility
      } catch (err) {
        if (__DEV__) {
          console.warn('[OfflineFirstFacilityRepo.getById] remote failed, trying cache', {
            projectId,
            facilityId,
            err,
          })
        }

        const cached = await sqliteFacilityRepo.getById(facilityId)
        if (cached) return cached

        // Si tampoco está en cache, respetamos contrato y tiramos error
        throw err
      }
    }

    // Sin conexión → solo cache
    const cached = await sqliteFacilityRepo.getById(facilityId)
    if (cached) return cached

    throw new Error('Facility not available offline')
  }

  // Helpers internos
  /**
   * Arma una FacilitiesPage a partir de lo cacheado en SQLite.
   * No hay paginación real: devolvemos todos los items que matcheen filtros.
   */
  private async listFromCache(
    projectId: ProjectId,
    params?: ListFacilitiesParams,
  ): Promise<FacilitiesPage> {
    const cached = await sqliteFacilityRepo.listByProjectCached(projectId, {
      status: params?.status,
      search: params?.search ?? '',
    })

    return {
      items: cached,
      limit: params?.limit ?? 0,
      nextCursor: '',
    }
  }
}

// Factory para wiring desde features/hooks
export const createOfflineFirstFacilityRepo = (): FacilityRepo => new OfflineFirstFacilityRepo()
