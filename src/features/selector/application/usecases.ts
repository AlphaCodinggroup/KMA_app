import type { FlowSummary, Flow } from '@entities/flow/model'
import { http } from '@core/http/http'
import { Env } from '@shared/config/env'
import { FlowsResponseDtoSchema } from '@entities/flow/api/flow.dto'
import { mapFlowsResponseDto } from '@entities/flow/lib/mappers'

/** Devuelve la base URL de la API con fallback seguro. */
const getApiBaseUrl = (): string =>
  Env.apiBaseUrl ?? (process.env.EXPO_PUBLIC_API_BASE_URL as string) ?? ''

/**
 * Carga todos los flows completos.
 */
export async function loadAllFlowsWithSteps(): Promise<Flow[]> {
  const baseURL = getApiBaseUrl()
  const res = await http.request({
    method: 'GET',
    url: `${baseURL}/flows`,
  })
  const parsed = FlowsResponseDtoSchema.parse(res.data)
  const flows = mapFlowsResponseDto(parsed)
  return flows
}

/**
 * Carga el catálogo resumido para las tarjetas del Selector.
 * Deriva del resultado completo para no duplicar I/O ni lógica de mapeo.
 */
export async function loadCatalog(): Promise<FlowSummary[]> {
  const flows = await loadAllFlowsWithSteps()

  const summaries: FlowSummary[] = flows.map(f => ({
    id: f.flowId, // En dominio es flowId; el resumen usa id
    title: f.title,
    version: String(f.version),
    description: f.description,
    stepsCount: f.steps.length,
    flowType: f.flowType,
    isActive: f.isActive,
  }))

  return summaries
}

/**
 * Sincronización en frío (placeholder).
 * En una siguiente iteración podemos:
 *  - leer /flows/all (si el backend lo expone),
 *  - persistir catálogo + steps en SQLite,
 *  - y preparar cache offline para SelectorScreen.
 */
export async function coldSyncAllFlows(): Promise<void> {
  return
}
