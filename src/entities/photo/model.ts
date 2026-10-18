/**
 * Estado de subida de una foto capturada (tabla `photo_uploads`).
 * - pending: registrada, todavía no se subió.
 * - uploading: hay una subida en curso (al arrancar la app vuelve a `pending`).
 * - uploaded: el objeto está en S3 (`remoteUrl`).
 * - failed: la subida falló; espera un reintento.
 */
export type PhotoUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface PhotoUpload {
  /** Id de la foto: nombre base del archivo local (lo genera `persistPhoto`). */
  id: string
  submissionId: string
  /** Id de auditoría V2; null mientras la submission es v1 o no se conoce. */
  auditId?: string | undefined
  stepId: string
  fieldId: string
  localUri: string
  /** Nombre estable de subida: `<stepId>_<fieldId>_<photoId>.<ext>` (BE-5). */
  uploadName: string
  /** `file_url` que devolvió el presign (`s3://...`). */
  remoteUrl?: string | undefined
  s3Key?: string | undefined
  uploadUrl?: string | undefined
  /** Vencimiento de `uploadUrl`, en epoch ms. */
  expiresAt?: number | undefined
  status: PhotoUploadStatus
  attempts: number
  lastError?: string | undefined
  createdAt: number
  updatedAt: number
}

/** Lo mínimo para registrar una foto nueva (siempre nace `pending`). */
export type NewPhotoUpload = Pick<
  PhotoUpload,
  'id' | 'submissionId' | 'stepId' | 'fieldId' | 'localUri' | 'uploadName'
> & { auditId?: string | undefined }
