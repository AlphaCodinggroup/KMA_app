import type { FlowRepo, FlowsQuery } from '@entities/flow/ports'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { parseFlowsResponseDto, mapFlowsResponseDto } from '@entities/flow/lib/mappers'
import { Env } from '@shared/config/env'
import type { GenericAbortSignal, AxiosRequestConfig } from 'axios'
import { http } from '@core/http/http'

/**
 * Resuelve la baseURL de la API. Prioriza Env, cae en EXPO_PUBLIC_ si no está mapeado.
 */
function getBaseUrl(): string {
  return Env.apiBaseUrl || (process.env.EXPO_PUBLIC_API_BASE_URL as string) || ''
}

/**
 * Arma una URL segura respetando base y path.
 */
function buildUrl(path: string): string {
  const base = getBaseUrl()
  // Permite base con/ sin slash final
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Mapea a FlowSummary desde Flow de dominio.
 */
function toSummary(f: Flow): FlowSummary {
  return {
    id: f.id,
    title: f.title,
    version: String(f.version),
    description: f.description ?? '',
    stepsCount: f.steps.length,
  }
}

/**
 * Implementación HTTP del repositorio de Flows.
 * Requiere que el http client ya tenga interceptores de Authorization.
 */
export class HttpFlowRepo implements FlowRepo {
  async getAll(query?: FlowsQuery): Promise<Flow[]> {
    const url = buildUrl('/flows')

    const config: AxiosRequestConfig | undefined = query?.signal
      ? { signal: query.signal as unknown as GenericAbortSignal }
      : undefined

    const resp = await http.get(url, config)

    // Validamos payload crudo y mapeamos a dominio
    const dto = parseFlowsResponseDto(resp.data)
    const flows = mapFlowsResponseDto(dto)
    return flows
  }

  async getById(id: string, opts?: { signal?: AbortSignal }): Promise<Flow | null> {
    // La API actual solo expone /flows (lista). Filtramos en cliente.
    const flows = await this.getAll(opts?.signal ? { signal: opts.signal } : undefined)
    return flows.find(f => f.id === id) ?? null
  }

  async getSummaries(query?: FlowsQuery): Promise<FlowSummary[]> {
    const flows = await this.getAll(query)
    return flows.map(toSummary)
  }
}

/**
 * Factory sencilla para wiring en bootstrap o DI casero.
 */
export const createHttpFlowRepo = (): FlowRepo => new HttpFlowRepo()
