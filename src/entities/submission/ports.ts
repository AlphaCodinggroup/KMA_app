import type { SubmissionDraft } from './model'

/**
 * Identificador interno de una submission local.
 * Corresponde al campo `id` de la tabla `submissions`.
 */
export type SubmissionId = string

/**
 * Estado local de una submission.
 * - draft: en edición, todavía no se encoló.
 * - queued: con item pendiente en el outbox.
 * - failed: el outbox agotó reintentos o recibió un error no recuperable.
 * - legacy: filas previas a la migración 4 sin item en outbox (no se muestran ni se borran).
 * - submitted: auditoría V2 enviada y confirmada por el backend (2xx del submit). Se conserva la
 *   fila (con `server_version`) para poder editarla después (E4); la limpieza llega con D4.
 */
export type SubmissionStatus = 'draft' | 'queued' | 'failed' | 'legacy' | 'submitted'

/**
 * Pipeline de envío con el que nació la submission (se decide al crearla y no cambia):
 * - v1: `/uploads` → PUT S3 → `POST /audits` con todo (camino actual).
 * - v2: create temprano del borrador en el backend + deltas + submit (RFC Auditorías V2).
 */
export type SubmissionPipeline = 'v1' | 'v2'

/**
 * Snapshot completo de una submission guardada localmente.
 *
 * - Incluye el draft (flowId, title, createdAt, answers).
 * - Metadatos opcionales de contexto (project, facility, versión).
 * - Flags técnicos para sync/archivado.
 */
export type SubmissionSnapshot = SubmissionDraft & {
  id: SubmissionId
  /**
   * Proyecto al que pertenece la auditoría.
   */
  projectId?: string | undefined
  /**
   * Facility / building asociado.
   */
  facilityId?: string | undefined
  /**
   * Versión del flow usada al momento de responder.
   */
  version?: string | undefined
  /**
   * Indica si esta submission ya fue sincronizada con el backend.
   * Mapea contra la columna `synced` (0/1) en SQLite.
   */
  synced: boolean
  /**
   * Indica si dentro del draft hay al menos una foto/archivo local.
   * Mapea contra `has_files` (0/1).
   */
  hasFiles: boolean
  /** Estado local (columna `status`). */
  status: SubmissionStatus
  /** Último error registrado al pasar a `failed`. */
  lastError?: string
  /** Usuario dueño de la submission (null en filas anteriores a la migración 4). */
  userId?: string
  /** Última modificación local (epoch ms). */
  updatedAt?: number
  /** Pipeline de envío (filas anteriores a la migración 6 son `v1`). */
  pipeline: SubmissionPipeline
  /** Id de la auditoría en el backend (`audit_<uuid>_<ts>`); sólo en pipeline v2. */
  auditId?: string
  /** Versión confirmada por el backend; null/ausente hasta que el create se aplicó. */
  serverVersion?: number
  /** Estado de la auditoría en el backend (`audit_in_progress`, ...). */
  serverStatus?: string
}

/**
 * Parámetros para guardar/actualizar un borrador local.
 *
 * - Si viene `id`, se hace un update de la submission existente.
 * - Si no viene `id`, se crea una nueva submission con id generado.
 */
export interface SaveDraftInput {
  id?: SubmissionId
  draft: SubmissionDraft
  projectId?: string
  facilityId?: string
  version?: string
  userId?: string
  /**
   * Id de auditoría V2. Sólo se escribe al INSERTAR: la fila nace con `pipeline = 'v2'` y
   * `server_status = 'audit_in_progress'`. Un update posterior no lo toca.
   */
  auditId?: string
}

/** Estado de sync V2 de una submission (columnas de la migración 6). */
export type SubmissionSyncState = {
  pipeline: SubmissionPipeline
  serverVersion: number | null
  answerSyncJson: string | null
  deletedStepIdsJson: string | null
}

/**
 * Puerto del repositorio de Submissions locales.
 *
 * Implementación concreta: `sqliteSubmissionRepo` en `@core/repos`.
 * Desde los casos de uso (FlowRunner, sync) sólo se habla con esta interfaz.
 */
export interface SubmissionRepo {
  /**
   * Inserta o actualiza un borrador local.
   * Devuelve el `id` persistido para poder referenciarlo luego
   */
  saveDraft(input: SaveDraftInput): Promise<{ id: SubmissionId }>

  /**
   * Obtiene una submission completa por su id.
   * Devuelve null si no existe.
   */
  getById(id: SubmissionId): Promise<SubmissionSnapshot | null>

  /**
   * Marca una submission como sincronizada correctamente con el backend.
   * Usaremos esto después de que el sync/outbox termine en 2xx y hayamos
   * limpiado los archivos asociados.
   */
  markSynced(id: SubmissionId): Promise<void>

  /**
   * Lista submissions por estado, de la más reciente a la más antigua.
   * Si viene `userId`, filtra sólo las de ese usuario.
   */
  listByStatus(status: SubmissionStatus, userId?: string): Promise<SubmissionSnapshot[]>

  /**
   * Draft más reciente del usuario para un flow + proyecto + facility, o null.
   * Filtra en SQL: no parsea los payloads de los demás drafts.
   */
  findDraft(params: {
    flowId: string
    projectId?: string
    facilityId?: string
    userId?: string
  }): Promise<SubmissionSnapshot | null>

  /**
   * Cambia el estado de una submission. `lastError` se guarda tal cual;
   * si no viene, se limpia.
   */
  markStatus(id: SubmissionId, status: SubmissionStatus, lastError?: string): Promise<void>

  /**
   * Estado de sync V2 sin parsear el payload de respuestas (lectura liviana).
   * Devuelve null si la submission no existe.
   */
  getSyncState(id: SubmissionId): Promise<SubmissionSyncState | null>

  /**
   * Guarda el estado de sync por paso (JSON de `answer_sync_json` / `deleted_step_ids_json`).
   * Los campos que no vienen no se tocan.
   */
  saveSyncState(
    id: SubmissionId,
    state: { answerSyncJson?: string | null; deletedStepIdsJson?: string | null },
  ): Promise<void>

  /**
   * Guarda lo que el backend confirmó de una auditoría V2 (versión y, si viene, estado).
   */
  markServerState(
    id: SubmissionId,
    state: { serverVersion: number; serverStatus?: string },
  ): Promise<void>

  /**
   * Elimina completamente una submission local.
   * Útil para limpieza agresiva o para casos de error irrecuperable.
   */
  delete(id: SubmissionId): Promise<void>
}

/**
 * Alias para DI si querés usarlo más adelante.
 */
export type ISubmissionRepo = SubmissionRepo

/**
 * Implementación por defecto "no implementado" para tests o wiring parcial.
 */
export const SubmissionRepoNotImplemented: SubmissionRepo = {
  async saveDraft() {
    throw new Error('SubmissionRepo.saveDraft no implementado')
  },
  async getById() {
    throw new Error('SubmissionRepo.getById no implementado')
  },
  async markSynced() {
    throw new Error('SubmissionRepo.markSynced no implementado')
  },
  async listByStatus() {
    throw new Error('SubmissionRepo.listByStatus no implementado')
  },
  async findDraft() {
    throw new Error('SubmissionRepo.findDraft no implementado')
  },
  async markStatus() {
    throw new Error('SubmissionRepo.markStatus no implementado')
  },
  async getSyncState() {
    throw new Error('SubmissionRepo.getSyncState no implementado')
  },
  async saveSyncState() {
    throw new Error('SubmissionRepo.saveSyncState no implementado')
  },
  async markServerState() {
    throw new Error('SubmissionRepo.markServerState no implementado')
  },
  async delete() {
    throw new Error('SubmissionRepo.delete no implementado')
  },
}
