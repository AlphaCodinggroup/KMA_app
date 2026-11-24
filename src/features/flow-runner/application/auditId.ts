import { randomUUID } from 'expo-crypto'
import { buildAuditId } from '../lib/auditId'

/** Genera un id de auditoría V2 nuevo (`audit_<uuidv4>_<yyyyMMddHHmmss>`). */
export function newAuditId(now: Date = new Date()): string {
  return buildAuditId(randomUUID(), now)
}
