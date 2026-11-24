/**
 * Id de auditoría V2 (BE-7): `audit_<uuidv4>_<yyyyMMddHHmmss>`, máx. 128 caracteres.
 * Puro: el UUID se inyecta (ver `application/auditId.ts` para el generador con `expo-crypto`).
 */

export const AUDIT_ID_MAX_LENGTH = 128

const UUID_V4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
export const AUDIT_ID_REGEX = new RegExp(`^audit_${UUID_V4}_\\d{14}$`, 'i')

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/** `yyyyMMddHHmmss` en UTC. */
export function formatAuditTimestamp(date: Date): string {
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  )
}

export function isValidAuditId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= AUDIT_ID_MAX_LENGTH && AUDIT_ID_REGEX.test(id)
}

/** Arma el id a partir de un UUID v4 y una fecha. Lanza si el resultado no cumple el formato. */
export function buildAuditId(uuid: string, now: Date = new Date()): string {
  const id = `audit_${uuid.toLowerCase()}_${formatAuditTimestamp(now)}`
  if (!isValidAuditId(id)) throw new Error(`Invalid audit id generated: ${id}`)
  return id
}
