import type { FlowSummary } from '@entities/flow/model'
import { MOCK_FLOWS } from '@shared/mocks/flows'

export async function getFlowsCatalog(): Promise<{ flows: FlowSummary[] }> {
  const flows: FlowSummary[] =
    (MOCK_FLOWS.flows ?? []).map(f => ({
      id: f.id,
      title: f.title,
      version: f.version,
      description: f.description ?? '',
      stepsCount: f.stepsCount ?? 0,
    })) ?? []

  return { flows }
}
