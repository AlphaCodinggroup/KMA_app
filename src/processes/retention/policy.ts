/**
 * Política de retención local de fotos (8.M). Funciones puras: sin SQLite, sin archivos.
 *
 * Una auditoría V2 enviada conserva sus fotos 7 días en el dispositivo (revisar o editar offline lo
 * reciente, margen ante errores del backend posteriores al 2xx). Con poco espacio libre se liberan
 * antes, pero nunca antes de 24 h.
 */

export const PHOTO_RETENTION_DAYS = 7
export const PHOTO_RETENTION_MS = PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000
export const PRESSURE_MIN_AGE_MS = 24 * 60 * 60 * 1000

/** Frecuencia máxima de la limpieza: una vez por día; con poco espacio, una vez por hora. */
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000
export const RETENTION_INTERVAL_PRESSURE_MS = 60 * 60 * 1000

export type RetentionCandidate = {
  submissionId: string
  /** Cuándo el backend confirmó la auditoría (epoch ms). */
  confirmedAt: number
  /** ¿Quedan fotos locales de esta auditoría? */
  hasPhotos: boolean
  /** ¿Todas sus fotos están `uploaded`? Sin eso nunca se borra nada. */
  allUploaded: boolean
}

export type RetentionAction = 'purge-all' | 'purge-photos'

export function isRetentionDue(lastRunAt: number | null, now: number, pressure: boolean): boolean {
  if (lastRunAt === null) return true
  const interval = pressure ? RETENTION_INTERVAL_PRESSURE_MS : RETENTION_INTERVAL_MS
  return now - lastRunAt >= interval
}

/**
 * Qué hacer con una auditoría confirmada:
 * - 'purge-all': pasó el plazo (7 días) → fotos, filas de `photo_uploads` y la submission.
 * - 'purge-photos': con poco espacio y ≥ 24 h → sólo las fotos; la submission (y su
 *   `server_version`) se conserva hasta cumplir el plazo.
 * - null: todavía no corresponde, o hay fotos sin respaldar (nunca se borran).
 */
export function decideRetention(
  candidate: RetentionCandidate,
  now: number,
  pressure: boolean,
): RetentionAction | null {
  if (!candidate.allUploaded) return null

  const age = now - candidate.confirmedAt
  if (age >= PHOTO_RETENTION_MS) return 'purge-all'
  if (pressure && candidate.hasPhotos && age >= PRESSURE_MIN_AGE_MS) return 'purge-photos'
  return null
}
