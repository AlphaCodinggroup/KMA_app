/** Envío de una edición de auditoría ya enviada (`PATCH /audits/{id}`), uno por auditoría. */
export const AUDIT_UPDATE_ENDPOINT = 'AUDIT_UPDATE'

export const auditUpdateItemId = (auditId: string): string => `${AUDIT_UPDATE_ENDPOINT}:${auditId}`
