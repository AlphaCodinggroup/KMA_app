import type { AuditAnswer, CompletedAudit } from '@entities/audit/model'
import type { SubmissionSnapshot } from '@entities/submission/ports'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { sqliteAuditRepo } from '@core/repos/sqliteAuditRepo'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { getCurrentUserId } from '@shared/session/session'
import { offlineAuditRepo } from '../data/audit.repo.offline'
import { AUDIT_UPDATE_ENDPOINT, auditUpdateItemId } from '../lib/outbox'

const DEFAULT_STATUS = 'draft_report_pending_review'

/**
 * Submission local que todavía no terminó de llegar al backend, vista como auditoría
 * ("Pending sync" / "Failed"). Sus respuestas viven en la submission, no acá.
 */
function pendingToAudit(s: SubmissionSnapshot, facilityId: string): CompletedAudit {
  const flowVersion = s.version ? Number(s.version) : NaN
  return {
    id: s.auditId ?? s.id,
    flowId: s.flowId,
    flowVersion: Number.isFinite(flowVersion) ? flowVersion : undefined,
    flowName: s.title,
    projectId: s.projectId,
    facilityId,
    status: s.serverStatus ?? DEFAULT_STATUS,
    version: s.serverVersion ?? 1,
    createdAt: new Date(s.createdAt).toISOString(),
    syncState: s.status === 'failed' ? 'failed' : 'pending',
    localSubmissionId: s.id,
  }
}

/**
 * Auditorías completadas de una facility, de la más reciente a la más vieja:
 * lo que el backend ya tiene (cache) más lo que sigue en el outbox. Si una auditoría está en las
 * dos partes manda la local mientras no esté confirmada (su estado de sync es el que importa).
 */
export async function listCompletedAudits(facilityId: string): Promise<CompletedAudit[]> {
  const userId = getCurrentUserId()
  if (!userId) return []

  const [cached, queued, failed] = await Promise.all([
    offlineAuditRepo.listByFacility(facilityId),
    sqliteSubmissionRepo.listByStatus('queued', userId),
    sqliteSubmissionRepo.listByStatus('failed', userId),
  ])

  const pending = [...queued, ...failed]
    .filter(s => s.facilityId === facilityId)
    .map(s => pendingToAudit(s, facilityId))

  const pendingIds = new Set(pending.map(a => a.id))
  const merged = [...pending, ...cached.filter(a => !pendingIds.has(a.id))]

  return merged.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

/** Detalle de una auditoría con sus respuestas (online → backend + cache; offline → cache). */
export function getCompletedAudit(
  id: string,
  opts?: { signal?: AbortSignal },
): Promise<CompletedAudit | null> {
  return offlineAuditRepo.getById(id, opts)
}

/**
 * Encola (o reutiliza) el `AUDIT_UPDATE` de la auditoría y dispara el sync. Un solo item por
 * auditoría: editar de nuevo antes de que salga el anterior no genera un segundo envío.
 */
export async function enqueueAuditUpdate(auditId: string): Promise<void> {
  const userId = getCurrentUserId()
  await sqliteOutboxRepo.enqueueUnique({
    id: auditUpdateItemId(auditId),
    endpoint: AUDIT_UPDATE_ENDPOINT,
    method: 'USECASE',
    payload: { auditId },
    ...(userId ? { userId } : {}),
  })
  triggerOutboxSync()
}

/**
 * Guarda la edición de una auditoría en el teléfono (marca `editedAt`, queda `pending`) y la
 * encola para enviarla. Offline queda en el outbox y sale cuando vuelve la red.
 */
export async function saveAuditEdit(
  id: string,
  edit: { answers: AuditAnswer[]; deletedStepIds: string[]; changedStepIds: string[] },
): Promise<void> {
  await offlineAuditRepo.saveEdit(id, edit)
  await enqueueAuditUpdate(id)
}

/** Reintento manual de una edición que el backend rechazó o agotó intentos. */
export async function retryAuditEdit(id: string): Promise<void> {
  const userId = getCurrentUserId()
  if (!userId) return
  await sqliteAuditRepo.setEditState(userId, id, 'pending')
  await enqueueAuditUpdate(id)
}
