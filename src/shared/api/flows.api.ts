import type { FlowSummary } from '@entities/flow/model'
import { MOCK_FLOWS, allFlows, flowDetail } from '@shared/mocks/flows'

export async function getFlowsCatalog(): Promise<{ flows: FlowSummary[] }> {
  return {
    flows: (MOCK_FLOWS.flows ?? []).map(f => ({
      id: f.id,
      title: f.title,
      version: f.version,
      description: f.description ?? '',
      stepsCount: f.stepsCount ?? 0,
    })),
  }
}

export async function apiGetAllFlows(): Promise<typeof allFlows> {
  return allFlows
}

export async function apiGetFlow(flowId: string) {
  const found = allFlows.flows.find(f => f.flowId === flowId)
  if (found) return found
  if (flowDetail.flowId === flowId) return flowDetail
  return null
}
