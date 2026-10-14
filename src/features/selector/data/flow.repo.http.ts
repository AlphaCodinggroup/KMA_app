import type { FlowRepo, FlowsQuery } from '@entities/flow/ports'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { FlowItemDtoSchema, FlowsEnvelopeDtoSchema } from '@entities/flow/api/flow.dto'
import { mapFlowItemDto } from '@entities/flow/lib/mappers'
import { Env } from '@shared/config/env'
import type { GenericAbortSignal, AxiosRequestConfig } from 'axios'
import { http } from '@core/http/http'

/** Resuelve la baseURL de la API desde Env. */
function getBaseUrl(): string {
  return Env.apiBaseUrl
}

/** Arma una URL segura respetando base y path. */
function buildUrl(path: string): string {
  const base = getBaseUrl()
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Mapea a FlowSummary desde Flow de dominio.
 * Incluye metadatos útiles para la UI actual (flowType, isActive, stepsCount, timestamps).
 */
function toSummary(f: Flow): FlowSummary {
  return {
    id: f.flowId,
    title: f.title,
    version: String(f.version),
    description: f.description ?? '',
    stepsCount: f.steps.length,
    flowType: f.flowType ?? '',
    isActive: f.isActive ?? true,
    createdAt: f.createdAt ?? '',
    updatedAt: f.updatedAt ?? '',
  }
}

/** Flow del catálogo que no pasó la validación y se descartó. `id` es null si ni siquiera lo trae. */
export type DiscardedFlow = { id: string | null; reason: string }

export type FlowCatalogResult = { flows: Flow[]; discarded: DiscardedFlow[] }

/**
 * Implementación HTTP del repositorio de Flows.
 * Requiere que el http client ya tenga interceptores de Authorization.
 */
export class HttpFlowRepo implements FlowRepo {
  /**
   * Trae el catálogo y valida cada flow por separado: uno con un `type` desconocido (paso o campo)
   * se descarta y se loguea, el resto se usa normalmente. Sólo la envoltura inválida rechaza todo.
   */
  async fetchCatalog(query?: FlowsQuery): Promise<FlowCatalogResult> {
    const url = buildUrl('/flows')

    const config: AxiosRequestConfig | undefined = query?.signal
      ? { signal: query.signal as unknown as GenericAbortSignal }
      : undefined

    const resp = await http.get(url, config)

    const envelope = FlowsEnvelopeDtoSchema.parse(resp.data)

    const flows: Flow[] = []
    const discarded: DiscardedFlow[] = []

    for (const raw of envelope.flows) {
      const rawId =
        raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string'
          ? (raw as { id: string }).id
          : null

      const parsed = FlowItemDtoSchema.safeParse(raw)
      if (!parsed.success) {
        const reason = parsed.error.issues
          .slice(0, 3)
          .map(i => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
        discarded.push({ id: rawId, reason })
        if (__DEV__) console.warn('[HttpFlowRepo] Flow descartado por validación', rawId, reason)
        continue
      }

      try {
        flows.push(mapFlowItemDto(parsed.data))
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        discarded.push({ id: rawId, reason })
        if (__DEV__) console.warn('[HttpFlowRepo] Flow descartado al mapear', rawId, reason)
      }
    }

    return { flows, discarded }
  }

  async getAll(query?: FlowsQuery): Promise<Flow[]> {
    let { flows } = await this.fetchCatalog(query)

    // Filtros/paginación client-side
    const anyQuery = query as any

    //    - Filtrado por primera letra del flowType
    if (anyQuery?.flowTypeStartsWith) {
      const letter = String(anyQuery.flowTypeStartsWith).toUpperCase()
      flows = flows.filter(f => (f.flowType?.[0]?.toUpperCase() ?? '') === letter)
    }

    //    - offset / limit
    if (typeof query?.offset === 'number' || typeof query?.limit === 'number') {
      const start = query?.offset ?? 0
      const limit = query?.limit
      const end = typeof limit === 'number' ? start + limit : undefined
      flows = flows.slice(start, end)
    }

    return flows
  }

  async getById(id: string, opts?: { signal?: AbortSignal }): Promise<Flow | null> {
    // La API actual solo expone /flows (lista). Filtramos en cliente.
    const flows = await this.getAll(opts?.signal ? { signal: opts.signal } : undefined)
    return flows.find(f => f.flowId === id) ?? null
  }

  async getSummaries(query?: FlowsQuery): Promise<FlowSummary[]> {
    const flows = await this.getAll(query)
    return flows.map(toSummary)
  }
}

/** Factory sencilla para wiring en bootstrap o DI casero. */
export const createHttpFlowRepo = (): FlowRepo => new HttpFlowRepo()
