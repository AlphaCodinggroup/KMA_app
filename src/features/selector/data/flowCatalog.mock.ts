import type { FlowCatalogPort } from '@entities/flow/ports'
import type { FlowSummary } from '@entities/flow/model'
import { MOCK_FLOWS } from '@shared/mocks/flows'

export class MockFlowCatalogRepo implements FlowCatalogPort {
  async fetchCatalog(): Promise<FlowSummary[]> {
    // Simulamos latencia mínima para UX realista
    await new Promise(r => setTimeout(r, 300))
    return MOCK_FLOWS.flows
  }
}
