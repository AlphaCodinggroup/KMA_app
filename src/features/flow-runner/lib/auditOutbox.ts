/**
 * Tipos e ids de los items de outbox del ciclo V2. Los ids son deterministas por submission:
 * permiten (a) no duplicar items y (b) declarar `depends_on` sin leer la tabla.
 */

/** Create temprano del borrador en el backend. */
export const AUDIT_CREATE_ENDPOINT = 'AUDIT_CREATE'
/** Deltas de respuestas (`PATCH /audits/{id}`), coalescidos: uno por submission. */
export const AUDIT_DELTA_ENDPOINT = 'AUDIT_DELTA'

/** Subida de una foto (`POST /uploads` + `PUT` a S3). Uno por foto. */
export const PHOTO_UPLOAD_ENDPOINT = 'PHOTO_UPLOAD'

/** Submit final de la auditoría (`POST /audits/{id}/submit`). */
export const AUDIT_SUBMIT_ENDPOINT = 'AUDIT_SUBMIT'

export const auditCreateItemId = (submissionId: string): string =>
  `${AUDIT_CREATE_ENDPOINT}:${submissionId}`

export const auditDeltaItemId = (submissionId: string): string =>
  `${AUDIT_DELTA_ENDPOINT}:${submissionId}`

export const auditSubmitItemId = (submissionId: string): string =>
  `${AUDIT_SUBMIT_ENDPOINT}:${submissionId}`

export const photoUploadItemId = (photoId: string): string => `${PHOTO_UPLOAD_ENDPOINT}:${photoId}`
