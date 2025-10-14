import NetInfo from '@react-native-community/netinfo'
import type { FlowDetail } from '@shared/validation/steps.schema'
import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import { submitSubmissionMultipart, buildSubmissionMultipart } from '@shared/api/submissions.api'
import type { Flow, Step } from '@entities/flow/model'
import { createHttpFlowRepo } from '../data/flow.repo.http'

// Instancia del repositorio HTTP
const flowRepo = createHttpFlowRepo()

/** Best-effort: asegurar que el flow esté actualizado/local antes de ejecutar.
 */
export async function ensureFlowSynced(flowId: string): Promise<void> {
  // En una versión con cache/SQLite: verificar staleness y refrescar.
  void flowId
  return Promise.resolve()
}

/** Mapper de dominio → FlowDetail */
function mapToFlowDetail(flow: Flow): FlowDetail {
  return {
    flowId: flow.id,
    title: flow.title,
    version: String(flow.version),
    steps: flow.steps.map(mapStepToDetail),
  }
}

/** Paso: dominio → FlowDetail.Step */
function mapStepToDetail(step: Step): FlowDetail['steps'][number] {
  switch (step.type) {
    case 'Question': {
      return {
        id: step.id,
        type: 'Question',
        text: step.text,
        yesNext: step.yesNext,
        noNext: step.noNext,
      }
    }
    case 'Form': {
      return {
        id: step.id,
        type: 'Form',
        title: step.title,
        next: step.next,
        fields: step.fields.map(f => ({
          id: f.id,
          type: f.type,
          label: f.label,
        })),
      }
    }
    case 'Select': {
      return {
        id: step.id,
        type: 'Select',
        title: step.title,
        text: step.text,
        options: step.options.map(o => ({ label: o.label, next: o.next })),
      }
    }
    case 'End': {
      return {
        id: step.id,
        type: 'End',
      }
    }
    default: {
      const _exhaustive: never = step as never
      throw new Error(`mapStepToDetail: Tipo de Step no soportado: ${_exhaustive}`)
    }
  }
}

/** Carga detalle del flow desde la API (sin mocks). */
export async function loadFlowDetail(flowId: string): Promise<FlowDetail> {
  const flow = await flowRepo.getById(flowId)
  if (!flow) {
    // Si la API no trae el id solicitado, devolvemos error explícito.
    throw new Error(`Flow ${flowId} no encontrado`)
  }
  return mapToFlowDetail(flow)
}

/** Guarda borrador localmente (mock mínimo). En real → SQLite submissions.drafts */
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

  // Offline → Outbox (placeholder). En real: OutboxRepo.enqueue(...)
  console.log('[OUTBOX] Enqueued submission (offline):', JSON.stringify(draft, null, 2))
}
