import NetInfo from '@react-native-community/netinfo'
import type { FlowDetail } from '@shared/validation/steps.schema'

// Mocks actuales
import { allFlows, flowDetail as defaultFlowDetail } from '@shared/mocks/flows'

// Submissions API
import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import { submitSubmissionMultipart, buildSubmissionMultipart } from '@shared/api/submissions.api'

// TODO real: repos/servicios
// import { FlowRepo } from '@core/repos/flowRepo'
// import { OutboxRepo } from '@core/repos/outboxRepo'
// import { FileStore } from '@shared/storage/files'

/** Best-effort: asegurar que el flow esté actualizado/local antes de ejecutar. */
export async function ensureFlowSynced(flowId: string): Promise<void> {
  console.log({ flowId })
  // En real: si hay red -> GET /flows/{id} y persistir en SQLite
  // Por ahora con mocks no hace nada.
  await Promise.resolve()
}

/** Carga detalle del flow (mock first). */
export async function loadFlowDetail(flowId: string): Promise<FlowDetail> {
  const found = allFlows.flows.find(f => f.flowId === flowId)
  const data = found ?? defaultFlowDetail
  return data
}

/** Guarda borrador localmente (mock). En real -> SQLite submissions.drafts */
export async function persistDraft(params: {
  flowId: string
  title: string
  answers: Record<string, SubmissionAnswer>
}): Promise<void> {
  const payload = {
    flowId: params.flowId,
    title: params.title,
    createdAt: new Date().toISOString(),
    answers: params.answers,
  }
  console.log('[FLOW SUBMISSION DRAFT]', JSON.stringify(payload, null, 2))
}

/** Finaliza envío: si hay red intenta enviar; sino, encola en outbox. */
export async function finalizeSubmission(params: {
  flowId: string
  title: string
  answers: Record<string, SubmissionAnswer>
  online?: boolean
}): Promise<void> {
  const isOnline =
    typeof params.online === 'boolean' ? params.online : !!(await NetInfo.fetch()).isConnected

  const draft: SubmissionDraft = {
    flowId: params.flowId,
    title: params.title,
    createdAt: Date.now(),
    answers: params.answers,
  }

  if (isOnline) {
    const { payload } = await buildSubmissionMultipart(draft)
    console.log('[FINAL PAYLOAD PARA BACKEND]', JSON.stringify(payload, null, 2))
    await submitSubmissionMultipart(draft)
    // TODO real: borrar archivos temporales y registros locales confirmados
    return
  }

  // Offline → Outbox (mock)
  // En real: OutboxRepo.enqueue({ kind:'submission', body:draft, idempotencyKey: uuidv4() })
  console.log('[OUTBOX] Enqueued submission (offline):', JSON.stringify(draft, null, 2))
}
