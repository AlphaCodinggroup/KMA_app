import type { AuditId, AuditsPage, CompletedAudit } from '@entities/audit/model'
import type { AuditRepo, ListAuditsParams } from '@entities/audit/ports'
import { AuditItemDtoSchema } from '@entities/audit/api/audit.dto'
import {
  extractAuditsPage,
  mapAuditDtoToDomain,
  unwrapAuditDetail,
} from '@entities/audit/lib/mappers'
import { http } from '@core/http/http'

/**
 * Lectura HTTP de auditorías. Cada item del listado se valida por separado: uno malformado
 * se descarta y el resto se usa. Sólo una envoltura irreconocible rechaza la página.
 */
export class HttpAuditRepo implements AuditRepo {
  constructor(private readonly client = http) {}

  async list(params?: ListAuditsParams): Promise<AuditsPage> {
    const { data } = await this.client.get('/audits', {
      params: {
        auditor: params?.auditor,
        status: params?.status,
        limit: params?.limit,
        last_eval_id: params?.lastEvalId,
      },
      ...(params?.signal ? { signal: params.signal } : {}),
    })

    const page = extractAuditsPage(data)
    if (!page) throw new Error('Invalid audits list payload: no list found')

    const items: CompletedAudit[] = []
    for (const raw of page.rawItems) {
      const parsed = AuditItemDtoSchema.safeParse(raw)
      if (!parsed.success) {
        if (__DEV__) console.warn('[HttpAuditRepo] Auditoría descartada por validación')
        continue
      }
      items.push(mapAuditDtoToDomain(parsed.data))
    }

    return { items, lastEvalId: page.lastEvalId }
  }

  async getById(
    id: AuditId,
    opts?: { signal?: AbortSignal | undefined },
  ): Promise<CompletedAudit | null> {
    let data: unknown
    try {
      const resp = await this.client.get(`/audits/${encodeURIComponent(id)}`, {
        ...(opts?.signal ? { signal: opts.signal } : {}),
      })
      data = resp.data
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return null
      throw err
    }

    const parsed = AuditItemDtoSchema.safeParse(unwrapAuditDetail(data))
    if (!parsed.success) {
      const reason = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
      throw new Error(`Invalid audit detail payload: ${reason}`)
    }
    return mapAuditDtoToDomain(parsed.data)
  }
}

export function createHttpAuditRepo(client = http): AuditRepo {
  return new HttpAuditRepo(client)
}
