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
      // Upsert de cada flow (incluyendo metadatos extra si están en FlowSummary)
      for (const f of cat.flows) {
        const safeVersion = normalizeVersion(f.version)
        const anyFlow = f as any

        const flowType: string | null =
          typeof anyFlow.flowType === 'string' ? anyFlow.flowType : null

        const isActive: number | null =
          typeof anyFlow.isActive === 'boolean' ? (anyFlow.isActive ? 1 : 0) : null

        const createdAt: string | null =
          typeof anyFlow.createdAt === 'string' ? anyFlow.createdAt : null

        const updatedAt: string | null =
          typeof anyFlow.updatedAt === 'string' ? anyFlow.updatedAt : null

        await run(
          `INSERT OR REPLACE INTO flows (
             id,
             title,
             version,
             description,
             stepsCount,
             flowType,
             isActive,
             createdAt,
             updatedAt
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            f.id,
            f.title,
            safeVersion,
            f.description ?? null,
            f.stepsCount ?? null,
            flowType,
            isActive,
            createdAt,
            updatedAt,
          ],
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

  /**
   * Guarda el detalle completo de un flow (steps) y actualiza solo
   * los campos que realmente dependen del detalle.
   */
  async saveFlowDetail(detail: FlowDetail): Promise<void> {
    await withTransaction(async () => {
      const safeVersion = normalizeVersion(detail.version)

      // Aseguramos que exista la fila sin pisar metadatos si ya estaban
      await run(
        `INSERT OR IGNORE INTO flows (id, title, version, description, stepsCount)
         VALUES (?, ?, ?, ?, ?)`,
        [detail.flowId, detail.title, safeVersion, null, detail.steps.length],
      )

      // Actualizamos solo lo que depende del detalle
      await run(
        `UPDATE flows
           SET title = ?, version = ?, stepsCount = ?
         WHERE id = ?`,
        [detail.title, safeVersion, detail.steps.length, detail.flowId],
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
      flowType: string | null
      isActive: number | null
      createdAt: string | null
      updatedAt: string | null
    }>(
      `
      SELECT
        id,
        title,
        version,
        description,
        stepsCount,
        flowType,
        isActive,
        createdAt,
        updatedAt
      FROM flows
      ORDER BY title ASC
    `,
    )

    return {
      flows: rows.map(
        (r): FlowSummary => ({
          id: r.id,
          title: r.title,
          version: normalizeVersion(r.version),
          description: r.description ?? '',
          stepsCount: r.stepsCount ?? 0,
          flowType: r.flowType ?? '',
          isActive: r.isActive == null ? true : Boolean(r.isActive),
          createdAt: r.createdAt ?? '',
          updatedAt: r.updatedAt ?? '',
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

    const row = flow[0]
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
