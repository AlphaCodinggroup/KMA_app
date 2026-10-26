import type { AuditAnswerDTO, AuditItemDTO } from '@entities/audit/api/audit.dto'
import type { AuditAnswer, CompletedAudit } from '@entities/audit/model'

/**
 * Mappers de auditorías: DTO (snake_case) → dominio (camelCase).
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

export function mapAnswerDtoToDomain(dto: AuditAnswerDTO): AuditAnswer {
  return {
    stepId: dto.step_id,
    ...(dto.type !== undefined ? { type: dto.type } : {}),
    ...(dto.answer !== undefined ? { answer: dto.answer } : {}),
    ...(dto.values !== undefined ? { values: dto.values } : {}),
  }
}

export function mapAuditDtoToDomain(dto: AuditItemDTO): CompletedAudit {
  return {
    id: dto.id,
    flowId: dto.flow_id ?? '',
    flowVersion: dto.flow_version,
    flowName: dto.flow_name ?? dto.flow_id ?? '',
    projectId: dto.project_id,
    projectName: dto.project_name,
    facilityId: dto.facility_id,
    facilityName: dto.facility_name,
    status: dto.status ?? '',
    version: dto.version ?? 1,
    findingsCount: dto.findings_count,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    answers: dto.answers?.map(mapAnswerDtoToDomain),
    syncState: 'synced',
  }
}

/**
 * Saca los items y el token de paginación de la respuesta del listado. Tolera las envolturas
 * probables (`{ audits }`, `{ data: { audits } }`, `{ items }`, array directo) porque el contrato
 * no está fijado. Devuelve `null` si no encuentra una lista.
 */
export function extractAuditsPage(
  body: unknown,
): { rawItems: unknown[]; lastEvalId: string | undefined } | null {
  const candidates: unknown[] = [body]
  if (isRecord(body) && 'data' in body) candidates.push(body.data)

  for (const c of candidates) {
    if (Array.isArray(c)) return { rawItems: c, lastEvalId: undefined }
    if (!isRecord(c)) continue
    const list = c.audits ?? c.items ?? c.data
    if (!Array.isArray(list)) continue
    const token = c.last_eval_id ?? c.next_cursor
    return {
      rawItems: list,
      lastEvalId: typeof token === 'string' && token.length > 0 ? token : undefined,
    }
  }
  return null
}

/** El detalle puede venir plano o dentro de `data` / `audit`. */
export function unwrapAuditDetail(body: unknown): unknown {
  if (!isRecord(body)) return body
  if ('id' in body || 'audit_id' in body) return body
  if (isRecord(body.data)) return unwrapAuditDetail(body.data)
  if (isRecord(body.audit)) return body.audit
  return body
}
