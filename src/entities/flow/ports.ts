import type { FlowSummary } from './model'

export interface FlowCatalogPort {
  fetchCatalog(): Promise<FlowSummary[]>
}
