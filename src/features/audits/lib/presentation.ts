import { isAuditEditable } from '@entities/audit/lib/status'
import type { CompletedAudit } from '@entities/audit/model'

/** success = enviada · info = en cola · warning = edición sin enviar · error = falló · neutral = bloqueada */
export type AuditBadgeTone = 'success' | 'info' | 'warning' | 'error' | 'neutral'

export type AuditBadge = { label: string; tone: AuditBadgeTone }

/**
 * Etiqueta de estado para la lista de completados. El sync local manda sobre el del backend
 * (una auditoría en el outbox todavía no tiene estado confiable allá).
 */
export function auditBadge(audit: CompletedAudit): AuditBadge {
  if (audit.syncState === 'pending') return { label: 'Pending sync', tone: 'info' }
  if (audit.syncState === 'failed') return { label: 'Sync failed', tone: 'error' }
  if (audit.syncState === 'locked')
    return { label: 'Under review · edits not sent', tone: 'warning' }
  // Fuera de `draft_report_pending_review` un revisor ya la tomó o se cerró: no se edita
  if (!isAuditEditable(audit.status)) return { label: 'Locked', tone: 'neutral' }
  return { label: 'Submitted', tone: 'success' }
}

/** Fecha corta legible ("Oct 18, 2026, 3:42 PM"); '' si el valor no es una fecha válida. */
export function formatAuditDate(value: string | number | undefined): string {
  if (value === undefined || value === '') return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Se puede editar: el backend lo admite y la auditoría ya está en la cache (no sigue en el outbox).
 * Una edición sin enviar (`pending` / `failed`) se puede volver a editar; una `locked` (ya la tomó
 * un revisor) conserva su edición pero no admite otra.
 */
export const canEditAudit = (audit: CompletedAudit): boolean =>
  audit.syncState !== 'locked' && !audit.localSubmissionId && isAuditEditable(audit.status)
