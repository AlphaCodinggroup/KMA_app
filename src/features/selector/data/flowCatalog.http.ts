import type { FlowCatalogPort } from '@entities/flow/ports'
import type { FlowSummary } from '@entities/flow/model'
import { getFlowsCatalog } from '@shared/api/flows.api'
import { mapFlowSummaryDtoToDomain } from './mappers'

export class HttpFlowCatalogRepo implements FlowCatalogPort {
  async fetchCatalog(): Promise<FlowSummary[]> {
    const dto = await getFlowsCatalog()
    return dto.flows.map(mapFlowSummaryDtoToDomain)
  }
}
