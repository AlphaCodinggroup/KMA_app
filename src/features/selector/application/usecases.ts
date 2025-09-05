import type { FlowSummary } from '@entities/flow/model'
import { MOCK_FLOWS, allFlows, flowDetail } from '@shared/mocks/flows'

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

export type FlowDetail = {
  flowId: string
  title: string
  version: string
  steps: Array<any>
} | null

/** Detalle desde mocks. */
export async function loadFlowDetail(flowId: string): Promise<FlowDetail> {
  const found = allFlows.flows.find(f => f.flowId === flowId)
  if (found) return found
  if (flowDetail.flowId === flowId) return flowDetail
  return null
}
