import type { NewPhotoUpload, PhotoUpload, PhotoUploadStatus } from './model'

/**
 * Puerto del repositorio de subidas de fotos.
 * Implementación: `sqlitePhotoUploadRepo` en `@core/repos`.
 */
export interface PhotoUploadRepo {
  /**
   * Registra una foto como `pending`. Idempotente por `id`: si ya existe no la pisa
   * (una foto que ya está subiendo o subida conserva su estado).
   */
  register(photo: NewPhotoUpload): Promise<void>

  getById(id: string): Promise<PhotoUpload | null>

  /** Fotos de una submission, de la más vieja a la más nueva. */
  listBySubmission(submissionId: string): Promise<PhotoUpload[]>

  /**
   * Fotos de las auditorías V2 del usuario (join con `submissions`), de la más vieja a la más
   * nueva. Es lo que alimenta la UI de sincronización.
   */
  listV2ForUser(userId: string): Promise<PhotoUpload[]>

  /** Vuelve a `pending` las fotos `failed` (de una submission o de todas las del usuario). */
  requeueFailed(submissionId?: string): Promise<void>

  /** Fotos en un estado, de la más vieja a la más nueva. */
  listByStatus(status: PhotoUploadStatus, limit?: number): Promise<PhotoUpload[]>

  /** Guarda el presign de una foto (`upload_url`, `file_url` que tendrá y vencimiento en ms). */
  savePresign(
    id: string,
    presign: { uploadUrl: string; remoteUrl: string; expiresAt: number },
  ): Promise<void>

  /** Descarta el presign (venció o S3 respondió 403): la próxima subida vuelve a firmar. */
  clearPresign(id: string): Promise<void>

  markUploading(id: string): Promise<void>

  /** Subida confirmada (2xx de S3). */
  markUploaded(id: string, remoteUrl: string): Promise<void>

  /** Fallo recuperable: vuelve a `pending`, suma un intento y guarda el motivo. */
  markRetry(id: string, error: string): Promise<void>

  /** Fallo definitivo (p. ej. el archivo ya no existe o un 4xx): queda `failed`. */
  markFailed(id: string, error: string): Promise<void>

  /** Al arrancar la app: lo que quedó `uploading` (proceso muerto) vuelve a `pending`. */
  resetUploading(): Promise<void>

  /** Borra la fila de una foto por su URI local (el auditor la quitó del form). */
  deleteByLocalUri(localUri: string): Promise<void>

  /** Borra todas las filas de una submission (descartada, enviada o limpiada). */
  deleteBySubmission(submissionId: string): Promise<void>

  /**
   * Borra las filas `pending` de los pasos indicados (rama abandonada). Nunca toca `uploading` /
   * `uploaded` / `failed`.
   */
  deletePendingByStepIds(submissionId: string, stepIds: readonly string[]): Promise<void>
}
