import type { FlowSummary } from '@entities/flow/model'
import { query, run, withTransaction } from '@shared/storage/db'
import type { FlowDetail } from '@shared/validation/steps.schema'

export type FlowCatalog = { flows: FlowSummary[] }

/**
 * Normaliza cualquier valor de versión a un string no vacío.
 * Si viene null/undefined/'' → '1'.
 */
const normalizeVersion = (value: unknown): string => {
  if (value == null) return '1'
  const s = String(value).trim()
  return s === '' ? '1' : s
}

/**
 * Repositorio SQLite para catálogo de flows y sus steps.
 * - Usa tablas: flows, flow_steps (definidas en migrations.ts)
 * - Mantiene consistencia y hace upsert idempotente.
 */
export const sqliteFlowRepo = {
  /** Guarda (upsert) el catálogo de flows. Prunea los que ya no están. */
  async saveCatalog(cat: FlowCatalog): Promise<void> {
    const ids = cat.flows.map(f => f.id)

    await withTransaction(async () => {
      // Upsert de cada flow
      for (const f of cat.flows) {
        const safeVersion = normalizeVersion(f.version)

        await run(
          `INSERT OR REPLACE INTO flows (id, title, version, description, stepsCount)
           VALUES (?, ?, ?, ?, ?)`,
          [f.id, f.title, safeVersion, f.description ?? null, f.stepsCount ?? null],
        )
      }

      // Prune: elimina flows que no estén en el nuevo catálogo
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',')
        await run(`DELETE FROM flows WHERE id NOT IN (${placeholders})`, ids)
      } else {
        await run('DELETE FROM flows')
      }
    })
  },

  /** Guarda el detalle completo de un flow (steps) y actualiza su metadata. */
  async saveFlowDetail(detail: FlowDetail): Promise<void> {
    await withTransaction(async () => {
      const safeVersion = normalizeVersion(detail.version)

      // Asegura la fila en flows (title/version/stepsCount)
      await run(
        `INSERT OR REPLACE INTO flows (id, title, version, description, stepsCount)
         VALUES (?, ?, ?, ?, ?)`,
        [detail.flowId, detail.title, safeVersion, null, detail.steps.length],
      )

      // Reemplaza steps del flow
      await run('DELETE FROM flow_steps WHERE flow_id = ?', [detail.flowId])

      for (const s of detail.steps) {
        await run(
          `INSERT OR REPLACE INTO flow_steps (flow_id, step_id, step_json)
           VALUES (?, ?, ?)`,
          [detail.flowId, s.id, JSON.stringify(s)],
        )
      }
    })
  },

  /** Devuelve el catálogo local (puede estar vacío). */
  async getCatalog(): Promise<FlowCatalog> {
    const rows = await query<{
      id: string
      title: string
      version: string
      description: string | null
      stepsCount: number | null
    }>(`SELECT id, title, version, description, stepsCount FROM flows ORDER BY title ASC`)

    return {
      flows: rows.map(
        (r): FlowSummary => ({
          id: r.id,
          title: r.title,
          version: normalizeVersion(r.version),
          description: r.description ?? '',
          stepsCount: r.stepsCount ?? 0,
        }),
      ),
    }
  },

  /** Devuelve el detalle de un flow o null si no existe en SQLite. */
  async getFlowDetail(flowId: string): Promise<FlowDetail | null> {
    const flow = await query<{ title: string; version: string }>(
      `SELECT title, version FROM flows WHERE id = ? LIMIT 1`,
      [flowId],
    )
    if (flow.length === 0) return null

    // Nota: ordenamos por rowid para preservar orden de inserción
    const stepsRows = await query<{ step_json: string }>(
      `SELECT step_json FROM flow_steps WHERE flow_id = ? ORDER BY rowid ASC`,
      [flowId],
    )
    const row = flow?.[0]
    if (!row) return null

    const steps = stepsRows.map(r => JSON.parse(r.step_json))
    return {
      flowId,
      title: row.title,
      version: normalizeVersion(row.version),
      steps,
    }
  },

  /** Upsert conveniente cuando solo tenés un detalle. */
  async upsertFromDetail(detail: FlowDetail): Promise<void> {
    await this.saveFlowDetail(detail)
  },
}
