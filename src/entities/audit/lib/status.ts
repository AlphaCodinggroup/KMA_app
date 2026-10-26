/** Estados del backend (RFC Auditorías V2). */
export const AUDIT_STATUS_IN_PROGRESS = 'audit_in_progress'
export const AUDIT_STATUS_PENDING_REVIEW = 'draft_report_pending_review'

/**
 * El backend admite PUT/PATCH sólo en estos estados; después del review técnico responde 400.
 * `audit_in_progress` es un borrador de este mismo teléfono (se retoma desde "Resume draft").
 */
export const isAuditEditable = (status: string): boolean => status === AUDIT_STATUS_PENDING_REVIEW

/** Borradores en curso: no son "completados" y viven en `submissions`, no en la cache de audits. */
export const isAuditInProgress = (status: string): boolean => status === AUDIT_STATUS_IN_PROGRESS
