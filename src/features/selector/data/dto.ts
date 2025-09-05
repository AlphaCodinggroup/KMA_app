export type FlowSummaryDto = {
  id: string
  title: string
  version: string
  description?: string
  stepsCount?: number
}

export type FlowsCatalogDto = {
  flows: FlowSummaryDto[]
}
