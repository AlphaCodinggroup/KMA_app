import type { AuditAnswer, AuditId, CompletedAudit } from '@entities/audit/model'
import type { AuditCacheRepo, AuditRepo } from '@entities/audit/ports'
import { createHttpAuditRepo } from './audit.repo.http'
import { sqliteAuditRepo } from '@core/repos/sqliteAuditRepo'
import { isOnlineOnce } from '@shared/lib/network'
import { getCurrentUserId } from '@shared/session/session'

/**
 * Lectura offline-first de auditorías enviadas.
 * - Listado por facility: siempre desde SQLite (lo llena `syncCompletedAudits`).
 * - Detalle: online baja el detalle y lo cachea; offline o con error usa la cache.
 */
export class OfflineFirstAuditRepo {
  constructor(
    private readonly remote: AuditRepo = createHttpAuditRepo(),
    private readonly cache: AuditCacheRepo = sqliteAuditRepo,
  ) {}

  async listByFacility(facilityId: string): Promise<CompletedAudit[]> {
    const userId = getCurrentUserId()
    if (!userId) return []
    return this.cache.listByFacility(userId, facilityId)
  }

  /** Guarda una edición local. */
  async saveEdit(
    id: AuditId,
    edit: { answers: AuditAnswer[]; deletedStepIds: string[]; changedStepIds: string[] },
  ): Promise<void> {
    const userId = getCurrentUserId()
    if (!userId) throw new Error('No hay sesión para guardar la edición')
    await this.cache.saveEdit(userId, id, edit)
  }

  async getById(id: AuditId, opts?: { signal?: AbortSignal }): Promise<CompletedAudit | null> {
    const userId = getCurrentUserId()
    if (!userId) return null

    if (await isOnlineOnce()) {
      try {
        const remote = await this.remote.getById(id, opts)
        if (remote) {
          await this.cache.saveDetail(userId, remote)
          // Se relee de la cache: conserva lo que sólo existe en el teléfono (editedAt, snapshot).
          return (await this.cache.getById(userId, id)) ?? remote
        }
      } catch (err) {
        if (__DEV__) console.warn('[OfflineFirstAuditRepo.getById] remote failed, using cache', err)
      }
    }

    return this.cache.getById(userId, id)
  }
}

export const offlineAuditRepo = new OfflineFirstAuditRepo()
