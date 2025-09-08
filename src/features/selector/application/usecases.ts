import type { FlowSummary } from '@entities/flow/model'
import { MOCK_FLOWS, allFlows, flowDetail } from '@shared/mocks/flows'

export type FlowDetail = {
  flowId: string
  title: string
  version: string
  steps: Array<any>
} | null

/** Catálogo desde mocks de UI (sin HTTP ni SQLite). */
export async function loadCatalog(): Promise<FlowSummary[]> {
  return (MOCK_FLOWS.flows ?? []).map(f => ({
    id: f.id,
    title: f.title,
    version: f.version,
    description: f.description ?? '',
    stepsCount: f.stepsCount ?? 0,
  }))
}

/** Detalle desde mocks. */
export async function loadFlowDetail(flowId: string): Promise<FlowDetail> {
  const found = allFlows.flows.find(f => f.flowId === flowId)
  if (found) return found
  if (flowDetail.flowId === flowId) return flowDetail
  return null
}

/**
 * Sincronización “en frío” (mock).
 * En la implementación real, acá llamaríamos a:
 *  - GET /flows/all -> persistir en SQLite (flows, steps)
 *  - invalidar/actualizar cache local
 */
export async function coldSyncAllFlows(): Promise<void> {
  // Simula latencia mínima y “cacheo” (no-op con mocks)
  await new Promise(r => setTimeout(r, 120))
}
