import { z } from 'zod'

/**
 * DTOs de lectura de auditorías:
 *   GET /api/audits?auditor&status&limit&last_eval_id
 *   GET /api/audits/{id}
 *
 * Parseo laxo: sólo `id` es imprescindible. El resto cae a `undefined` si viene mal formado, para
 * que un campo raro no descarte toda la auditoría. El contrato exacto de la envoltura no está
 * documentado; `extractAuditsPage` / `unwrapAuditDetail` (mappers) toleran las variantes probables.
 */

const optionalString = z.string().optional().catch(undefined)
const optionalNumber = z.number().optional().catch(undefined)

export const AuditAnswerDtoSchema = z.looseObject({
  step_id: z.string(),
  type: optionalString,
  answer: z.unknown().optional(),
  values: z.record(z.string(), z.unknown()).optional().catch(undefined),
})
export type AuditAnswerDTO = z.infer<typeof AuditAnswerDtoSchema>

/** Acepta `audit_id` como alias de `id`. */
const withIdAlias = (v: unknown): unknown => {
  if (v && typeof v === 'object' && !('id' in v) && 'audit_id' in v) {
    return { ...(v as Record<string, unknown>), id: (v as Record<string, unknown>).audit_id }
  }
  return v
}

export const AuditItemDtoSchema = z.preprocess(
  withIdAlias,
  z.looseObject({
    id: z.string().min(1),
    flow_id: optionalString,
    flow_version: optionalNumber,
    flow_name: optionalString,
    project_id: optionalString,
    project_name: optionalString,
    facility_id: optionalString,
    facility_name: optionalString,
    status: optionalString,
    version: optionalNumber,
    findings_count: optionalNumber,
    created_at: optionalString,
    updated_at: optionalString,
    // Sólo en el detalle. Si viene algo que no es un array de pasos se ignora.
    answers: z.array(AuditAnswerDtoSchema).optional().catch(undefined),
  }),
)
export type AuditItemDTO = z.infer<typeof AuditItemDtoSchema>
