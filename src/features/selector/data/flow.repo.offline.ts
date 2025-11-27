import type { FlowRepo, FlowsQuery } from '@entities/flow/ports'
import type { Flow, FlowSummary } from '@entities/flow/model'
import type { FlowDetail } from '@shared/validation/steps.schema'
import { createHttpFlowRepo } from './flow.repo.http'
import { sqliteFlowRepo } from '@core/repos/sqliteFlowRepo'
import { isOnlineOnce } from '@shared/lib/network'

/**
 * Repo offline-first para Flows:
 *
 * - Online:
 *    - llama a la API vía HttpFlowRepo
 *    - sincroniza catálogo + detalle en SQLite (best-effort)
 * - Offline / error red:
 *    - reconstruye desde SQLite (flows + steps)
 */
class OfflineFirstFlowRepo implements FlowRepo {
  private readonly httpRepo: FlowRepo

  constructor() {
    this.httpRepo = createHttpFlowRepo()
  }

  /**
   * Retorna todos los flows completos (incluye steps).
   * - Online:
   *    - trae SIEMPRE el catálogo completo desde la API (ignorando filtros)
   *    - sincroniza SQLite
   *    - aplica filtros/paginación en memoria
   * - Offline / error API:
   *    - reconstruye todos los flows desde SQLite y aplica filtros/paginación
   */
  async getAll(query?: FlowsQuery): Promise<Flow[]> {
    const isOnline = await isOnlineOnce()

    if (isOnline) {
      const requestQuery: FlowsQuery | undefined = query?.signal
        ? { signal: query.signal }
        : undefined

      try {
        const remoteFlows = await this.httpRepo.getAll(requestQuery)

        // Best-effort: sincronizar cache local
        try {
          await this.cacheRemoteFlows(remoteFlows)
        } catch (err) {
          if (__DEV__) {
            console.warn('[OfflineFirstFlowRepo.getAll] cache sync failed', err)
          }
        }

        return applyFlowQuery(remoteFlows, query)
      } catch (err) {
        if (__DEV__) {
          console.warn('[OfflineFirstFlowRepo.getAll] remote failed, using cache', err)
        }
        return this.getAllFromCache(query)
      }
    }

    // Sin conexión → vamos directo a cache
    return this.getAllFromCache(query)
  }

  /**
   * Detalle de un flow:
   * - Online:
   *    - intenta traer desde API y cachea el detalle
   *    - si la API falla → intenta reconstruir desde SQLite
   * - Offline:
   *    - solo desde SQLite
   */
  async getById(id: string, opts?: { signal?: AbortSignal }): Promise<Flow | null> {
    const isOnline = await isOnlineOnce()

    if (isOnline) {
      try {
        const flow = await this.httpRepo.getById(id, opts)

        if (flow) {
          // Best-effort: cachear detalle
          try {
            await this.cacheFlowDetail(flow)
          } catch (err) {
            if (__DEV__) {
              console.warn('[OfflineFirstFlowRepo.getById] cache upsert failed', err)
            }
          }
        }

        return flow
      } catch (err) {
        if (__DEV__) {
          console.warn('[OfflineFirstFlowRepo.getById] remote failed, trying cache', id, err)
        }
        return this.getFromCacheById(id)
      }
    }

    return this.getFromCacheById(id)
  }

  /**
   * Resúmenes para Selector.
   * - Online:
   *    - trae catálogo completo
   *    - sincroniza SQLite
   *    - aplica filtros/paginación en memoria
   * - Offline / error:
   *    - lee catálogo de SQLite y aplica filtros/paginación
   */
  async getSummaries(query?: FlowsQuery): Promise<FlowSummary[]> {
    const isOnline = await isOnlineOnce()

    if (isOnline) {
      const requestQuery: FlowsQuery | undefined = query?.signal
        ? { signal: query.signal }
        : undefined

      try {
        const remoteFlows = await this.httpRepo.getAll(requestQuery)

        // Best-effort: sincronizar cache local
        try {
          await this.cacheRemoteFlows(remoteFlows)
        } catch (err) {
          if (__DEV__) {
            console.warn('[OfflineFirstFlowRepo.getSummaries] cache sync failed', err)
          }
        }

        const filtered = applyFlowQuery(remoteFlows, query)
        return filtered.map(flowToSummary)
      } catch (err) {
        if (__DEV__) {
          console.warn('[OfflineFirstFlowRepo.getSummaries] remote failed, using cache', err)
        }
        return this.getSummariesFromCache(query)
      }
    }

    return this.getSummariesFromCache(query)
  }

  // Helpers internos (cache / reconstrucción desde SQLite)

  /**
   * Sincroniza catálogo + detalle completo en SQLite a partir de los flows remotos.
   * - Guarda catálogo completo (prune de los que ya no existen).
   * - Guarda detalle (steps) de cada flow.
   */
  private async cacheRemoteFlows(flows: Flow[]): Promise<void> {
    const catalog: { flows: FlowSummary[] } = {
      flows: flows.map(flowToSummary),
    }

    // Catalogo con prune de ids que ya no existen
    await sqliteFlowRepo.saveCatalog(catalog)

    // Detalle de cada flow (steps)
    for (const flow of flows) {
      await this.cacheFlowDetail(flow)
    }
  }

  /**
   * Upsert del detalle de un flow en SQLite.
   */
  private async cacheFlowDetail(flow: Flow): Promise<void> {
    const detail: FlowDetail = {
      flowId: flow.flowId,
      title: flow.title,
      steps: flow.steps,
    }

    await sqliteFlowRepo.saveFlowDetail(detail)
  }

  /**
   * Reconstruye un Flow completo solo desde SQLite.
   */
  private async getFromCacheById(id: string): Promise<Flow | null> {
    const detail = await sqliteFlowRepo.getFlowDetail(id)
    if (!detail) return null

    return detailToFlow(detail)
  }

  /**
   * Reconstruye todos los flows desde SQLite y aplica filtros/paginación.
   */
  private async getAllFromCache(query?: FlowsQuery): Promise<Flow[]> {
    const { flows: summaries } = await sqliteFlowRepo.getCatalog()
    if (!summaries.length) return []

    const filteredSummaries = applySummaryQuery(summaries, query)
    const result: Flow[] = []

    for (const summary of filteredSummaries) {
      const detail = await sqliteFlowRepo.getFlowDetail(summary.id)
      if (!detail) continue
      result.push(detailToFlow(detail, summary))
    }

    return result
  }

  /**
   * Devuelve solo resúmenes desde SQLite.
   */
  private async getSummariesFromCache(query?: FlowsQuery): Promise<FlowSummary[]> {
    const { flows } = await sqliteFlowRepo.getCatalog()
    if (!flows.length) return []

    return applySummaryQuery(flows, query)
  }
}

/**
 * Factory para wiring desde bootstrap / DI casero.
 */
export const createOfflineFirstFlowRepo = (): FlowRepo => new OfflineFirstFlowRepo()

// -----------------------------------------------------------------------------
// Helpers puros (sin side-effects)
// -----------------------------------------------------------------------------

/**
 * Normaliza la versión a un número “sano” (>0).
 * Si el backend manda cualquier cosa rara (undefined, "v1", "", etc.)
 * devolvemos 1 como default.
 */
const normalizeVersion = (v: string | number | null | undefined): string => {
  if (v == null) return '1'
  if (typeof v === 'number') return String(v)

  const trimmed = v.trim()
  return trimmed === '' ? '1' : trimmed
}

/**
 * Convierte Flow dominio → FlowSummary (para tarjetas de Selector).
 * Siempre genera una versión numérica válida (para no romper el NOT NULL en SQLite).
 */
function flowToSummary(flow: Flow): FlowSummary {
  const version = normalizeVersion(flow.version)

  return {
    id: flow.flowId,
    title: flow.title,
    version, // número “sano” (>=1)
    description: flow.description ?? '',
    stepsCount: flow.steps.length,
    flowType: flow.flowType ?? '',
    isActive: flow.isActive ?? true,
  }
}

/**
 * Reconstruye Flow dominio a partir de FlowDetail + metadata opcional del catálogo.
 * - Si hay summary, se usan descripción / versión / flags desde ahí.
 * - Version cae en 1 si no se puede parsear nada razonable.
 */
function detailToFlow(detail: FlowDetail, summary?: FlowSummary): Flow {
  const versionSource = summary?.version
  let version = 1

  if (typeof versionSource === 'number') {
    version = versionSource
  } else if (typeof versionSource === 'string') {
    const numeric = Number(versionSource.replace(/^v/i, ''))
    version = Number.isFinite(numeric) && numeric > 0 ? numeric : 1
  }

  return {
    flowId: detail.flowId,
    title: detail.title,
    description: summary?.description ?? '',
    steps: detail.steps as any,
    flowType: summary?.flowType ?? '',
    version,
    isActive: summary?.isActive ?? true,
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * Aplica filtros/paginación sobre Flow[] en memoria.
 * Mantiene compatibilidad con HttpFlowRepo:
 *  - flowTypeStartsWith (no tipeado, viene en query como any)
 *  - offset / limit
 */
function applyFlowQuery(flows: Flow[], query?: FlowsQuery): Flow[] {
  if (!query) return flows

  const anyQuery = query as any
  let out = flows

  if (anyQuery.flowTypeStartsWith) {
    const letter = String(anyQuery.flowTypeStartsWith).toUpperCase()
    out = out.filter(f => (f.flowType?.[0]?.toUpperCase() ?? '') === letter)
  }

  if (typeof query.offset === 'number' || typeof query.limit === 'number') {
    const start = query.offset ?? 0
    const end = typeof query.limit === 'number' ? start + query.limit : undefined
    out = out.slice(start, end)
  }

  return out
}

/**
 * Versión de applyFlowQuery para FlowSummary[].
 * Si no tenemos flowType en cache, se usa la primera letra del title como fallback.
 */
function applySummaryQuery(summaries: FlowSummary[], query?: FlowsQuery): FlowSummary[] {
  if (!query) return summaries

  const anyQuery = query as any
  let out = summaries

  if (anyQuery.flowTypeStartsWith) {
    const letter = String(anyQuery.flowTypeStartsWith).toUpperCase()

    out = out.filter(s => {
      const base = (s.flowType || s.title || '').trim()
      return (base[0]?.toUpperCase() ?? '') === letter
    })
  }

  if (typeof query.offset === 'number' || typeof query.limit === 'number') {
    const start = query.offset ?? 0
    const end = typeof query.limit === 'number' ? start + query.limit : undefined
    out = out.slice(start, end)
  }

  return out
}
