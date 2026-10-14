import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { getCurrentUserId } from '@shared/session/session'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { notifyFailedAuditsChanged } from '@processes/sync/failedAuditsSignal'

export type FailedAudit = {
  submissionId: string
  title: string
  /** Mensaje legible para el auditor (`message` del backend o texto de respaldo). */
  message: string
}

const FALLBACK_MESSAGE = 'The audit could not be sent.'

/** `last_error` se guarda como JSON `{ status, error, message }`; tolera texto plano. */
function parseErrorMessage(lastError: string | undefined): string {
  if (!lastError) return FALLBACK_MESSAGE
  try {
    const parsed = JSON.parse(lastError) as { message?: unknown }
    if (typeof parsed?.message === 'string' && parsed.message.length > 0) return parsed.message
  } catch {
    // no era JSON: se muestra tal cual
  }
  return lastError
}

export async function listFailedAudits(): Promise<FailedAudit[]> {
  const userId = getCurrentUserId()
  if (!userId) return []
  const rows = await sqliteSubmissionRepo.listFailedSummaries(userId)
  return rows.map(row => ({
    submissionId: row.id,
    title: row.title,
    message: parseErrorMessage(row.lastError ?? undefined),
  }))
}

/** Vuelve a encolar una auditoría fallida y dispara el sync. */
export async function retryFailedAudit(submissionId: string): Promise<void> {
  const requeued = await sqliteOutboxRepo.requeueBySubmissionId(submissionId)
  if (!requeued) {
    // Sin fila en outbox (no debería pasar): se crea una nueva.
    await sqliteOutboxRepo.enqueue({
      endpoint: 'AUDIT_SUBMISSION',
      method: 'USECASE',
      payload: { submissionId },
    })
  }
  await sqliteSubmissionRepo.markStatus(submissionId, 'queued')
  notifyFailedAuditsChanged()
  triggerOutboxSync()
}
