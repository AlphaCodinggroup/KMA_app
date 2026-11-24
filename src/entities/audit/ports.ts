import type { AuditAnswer, AuditId, AuditsPage, CompletedAudit } from './model'

export interface ListAuditsParams {
  /** Email del auditor. */
  auditor?: string | undefined
  status?: string | undefined
  limit?: number | undefined
  lastEvalId?: string | undefined
  signal?: AbortSignal | undefined
}

/** Lectura remota (HTTP). */
export interface AuditRepo {
  list(params?: ListAuditsParams): Promise<AuditsPage>
  /** Detalle con `answers`. `null` si el backend no la encuentra. */
  getById(id: AuditId, opts?: { signal?: AbortSignal | undefined }): Promise<CompletedAudit | null>
}

/** Cache local (SQLite) de las auditorías del usuario. */
export interface AuditCacheRepo {
  /**
   * Guarda lo que trae el listado sin pisar el detalle ya bajado (si la versión no cambió).
   * Con `prune` borra las del usuario que ya no vinieron, salvo las editadas localmente.
   */
  upsertList(userId: string, items: CompletedAudit[], opts: { prune: boolean }): Promise<void>
  /** Guarda el detalle completo (con respuestas). */
  saveDetail(userId: string, audit: CompletedAudit): Promise<void>
  /**
   * Guarda una edición local: reemplaza las respuestas, marca `edited_at` y anota los pasos
   * eliminados. Mientras `edited_at` esté, el refresco del backend no pisa estas respuestas.
   */
  saveEdit(
    userId: string,
    id: AuditId,
    edit: { answers: AuditAnswer[]; deletedStepIds: string[]; changedStepIds: string[] },
  ): Promise<void>
  /** Estado de la edición (`failed` / `locked` / `pending`); no toca las respuestas. */
  setEditState(
    userId: string,
    id: AuditId,
    state: 'pending' | 'failed' | 'locked',
    status?: string,
  ): Promise<void>
  /** Reemplaza `file://` por la URL remota en las respuestas (fotos ya subidas). */
  replacePhotoUris(userId: string, id: AuditId, map: Record<string, string>): Promise<void>
  /**
   * Confirma un PATCH: guarda la versión/estado del backend y, si la edición no cambió mientras
   * viajaba (`editedAt` igual), la da por sincronizada. Devuelve si quedó `synced`.
   */
  ackEdit(
    userId: string,
    id: AuditId,
    ack: { editedAt: number; version: number; status?: string | undefined },
  ): Promise<boolean>
  setVersion(userId: string, id: AuditId, version: number): Promise<void>
  listByFacility(userId: string, facilityId: string): Promise<CompletedAudit[]>
  getById(userId: string, id: AuditId): Promise<CompletedAudit | null>
}
