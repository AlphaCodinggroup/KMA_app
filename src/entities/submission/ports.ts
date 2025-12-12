import type { SubmissionDraft } from './model'

/**
 * Identificador interno de una submission local.
 * Corresponde al campo `id` de la tabla `submissions`.
 */
export type SubmissionId = string

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
  projectId?: string
  /**
   * Facility / building asociado.
   */
  facilityId?: string
  /**
   * Versión del flow usada al momento de responder.
   */
  version?: string
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
  async delete() {
    throw new Error('SubmissionRepo.delete no implementado')
  },
}
