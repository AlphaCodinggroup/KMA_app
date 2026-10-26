/**
 * Dominio puro de auditorías ya enviadas (9.M "Review completed").
 * Distinto de `SubmissionSnapshot`: aquello es el estado local de envío; esto es la auditoría
 * tal como la ve el backend (más, si corresponde, su estado local de sync).
 */

export type AuditId = string

/**
 * Estado de sync de la auditoría respecto del backend:
 * - synced: el backend ya la tiene (viene del listado/detalle).
 * - pending: sigue en el outbox, o tiene una edición local sin enviar ("Pending sync").
 * - failed: el outbox agotó reintentos, o el backend rechazó la edición.
 * - locked: la edición no se pudo enviar porque un revisor ya tomó la auditoría (se conserva).
 */
export type AuditSyncState = 'synced' | 'pending' | 'failed' | 'locked'

/** Respuesta de un paso, con la forma que usa el backend en `answers`. */
export interface AuditAnswer {
  stepId: string
  type?: string | undefined
  /** Question / Select. */
  answer?: unknown
  /** Form. */
  values?: Record<string, unknown> | undefined
}

export interface CompletedAudit {
  id: AuditId
  flowId: string
  flowVersion?: number | undefined
  flowName: string
  projectId?: string | undefined
  projectName?: string | undefined
  facilityId?: string | undefined
  facilityName?: string | undefined
  /** Estado en el backend (`draft_report_pending_review`, `completed`, ...). */
  status: string
  /** Versión para concurrencia optimista (E4). */
  version: number
  findingsCount?: number | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
  /** Última edición hecha en el teléfono (epoch ms); la escribe E4. */
  editedAt?: number | undefined
  /** `undefined` = el detalle todavía no se bajó (el listado no trae respuestas). */
  answers?: AuditAnswer[] | undefined
  /** Pasos eliminados por la edición local respecto del servidor (van en `deleted_step_ids`). */
  deletedStepIds?: string[] | undefined
  /** Pasos cambiados por la edición local (únicos que viajan en el PATCH). */
  changedStepIds?: string[] | undefined
  /** Steps de la versión del flow con la que se hizo (BE-17 / E3); `undefined` si no se guardó. */
  flowSnapshot?: unknown
  syncState: AuditSyncState
  /** Submission local asociada cuando la auditoría todavía está en el outbox. */
  localSubmissionId?: string | undefined
}

export interface AuditsPage {
  items: CompletedAudit[]
  /** Token para la página siguiente (`last_eval_id`); `undefined` si no hay más. */
  lastEvalId?: string | undefined
}
