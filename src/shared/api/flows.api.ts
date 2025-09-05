import type { FlowsCatalogDto } from '@features/selector/data/dto'
import { http } from './http'
import {
  AllFlowsSchema,
  FlowCatalogSchema,
  FlowDetailSchema,
  type FlowCatalog,
  type FlowDetail,
} from '@shared/validation/steps.schema'

export async function apiGetFlows(): Promise<FlowCatalog> {
  const { data } = await http.get('/flows')
  return FlowCatalogSchema.parse(data)
}

export async function apiGetFlow(flowId: string): Promise<FlowDetail> {
  const { data } = await http.get(`/flows/${encodeURIComponent(flowId)}`)
  return FlowDetailSchema.parse(data)
}

export async function apiGetAllFlows(): Promise<{ flows: FlowDetail[] }> {
  const { data } = await http.get('/flows/all')
  const parsed = AllFlowsSchema.parse(data)
  return parsed
}

export async function getFlowsCatalog(): Promise<FlowsCatalogDto> {
  const res = await http.get<FlowsCatalogDto>('/flows')
  return res.data
}
