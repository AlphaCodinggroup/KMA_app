import type { AuditAnswer, CompletedAudit } from '@entities/audit/model'
import type { AuditCacheRepo } from '@entities/audit/ports'
import { query, run, withTransaction } from '@shared/storage/db'

type AuditRow = {
  id: string
  user_id: string
  flow_id: string | null
  flow_version: number | null
  flow_name: string | null
  project_id: string | null
  project_name: string | null
  facility_id: string | null
  facility_name: string | null
  status: string
  version: number
  findings_count: number | null
  created_at: string | null
  updated_at: string | null
  edited_at: number | null
  answers_json: string | null
  flow_snapshot_json: string | null
  deleted_step_ids_json: string | null
  changed_step_ids_json: string | null
  edit_state: string | null
}

const COLUMNS =
  'id, user_id, flow_id, flow_version, flow_name, project_id, project_name, facility_id, facility_name, status, version, findings_count, created_at, updated_at, edited_at, answers_json, flow_snapshot_json, deleted_step_ids_json, changed_step_ids_json, edit_state'

function parseJson<T>(json: string | null): T | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as T
  } catch {
    return undefined
  }
}

/**
 * Una edición sin enviar (`pending`, `failed`, `locked`) conserva respuestas, versión base y estado:
 * el PATCH sale con la versión sobre la que se editó, así un cambio ajeno aparece como 409.
 */
const UNSENT_EDIT = `(audits.edit_state IS NOT NULL AND audits.edit_state != 'synced')`

function syncStateOf(editState: string | null): CompletedAudit['syncState'] {
  if (editState === 'pending' || editState === 'failed' || editState === 'locked') return editState
  return 'synced'
}

function rowToAudit(row: AuditRow): CompletedAudit {
  return {
    id: row.id,
    flowId: row.flow_id ?? '',
    flowVersion: row.flow_version ?? undefined,
    flowName: row.flow_name ?? row.flow_id ?? '',
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    facilityId: row.facility_id ?? undefined,
    facilityName: row.facility_name ?? undefined,
    status: row.status,
    version: row.version,
    findingsCount: row.findings_count ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    editedAt: row.edited_at ?? undefined,
    answers: parseJson<AuditAnswer[]>(row.answers_json),
    flowSnapshot: parseJson<unknown>(row.flow_snapshot_json),
    deletedStepIds: parseJson<string[]>(row.deleted_step_ids_json),
    changedStepIds: parseJson<string[]>(row.changed_step_ids_json),
    syncState: syncStateOf(row.edit_state),
  }
}

/**
 * Cache SQLite de auditorías enviadas (tabla `audits`, migración 8). Cada fila es de un usuario:
 * dos cuentas en el mismo teléfono no se ven entre sí.
 */
export const sqliteAuditRepo: AuditCacheRepo = {
  async upsertList(userId, items, { prune }) {
    const now = Date.now()
    await withTransaction(async () => {
      for (const a of items) {
        // El listado no trae respuestas: se conservan las del detalle mientras la versión no cambie.
        await run(
          `INSERT INTO audits (
             id, user_id, flow_id, flow_version, flow_name, project_id, project_name,
             facility_id, facility_name, status, version, findings_count, created_at, updated_at,
             synced_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             user_id = excluded.user_id,
             flow_id = excluded.flow_id,
             flow_version = excluded.flow_version,
             flow_name = excluded.flow_name,
             project_id = excluded.project_id,
             project_name = excluded.project_name,
             facility_id = excluded.facility_id,
             facility_name = excluded.facility_name,
             status = CASE WHEN ${UNSENT_EDIT} THEN audits.status ELSE excluded.status END,
             findings_count = excluded.findings_count,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             synced_at = excluded.synced_at,
             answers_json = CASE WHEN ${UNSENT_EDIT}
                                   OR audits.version = excluded.version
                                 THEN audits.answers_json ELSE NULL END,
             version = CASE WHEN ${UNSENT_EDIT} THEN audits.version ELSE excluded.version END`,
          [
            a.id,
            userId,
            a.flowId || null,
            a.flowVersion ?? null,
            a.flowName || null,
            a.projectId ?? null,
            a.projectName ?? null,
            a.facilityId ?? null,
            a.facilityName ?? null,
            a.status,
            a.version,
            a.findingsCount ?? null,
            a.createdAt ?? null,
            a.updatedAt ?? null,
            now,
          ],
        )
      }

      if (prune) {
        // Lo que ya no vino del backend se va, salvo lo editado en el teléfono (E4).
        await run(
          `DELETE FROM audits
          WHERE user_id = ? AND (edit_state IS NULL OR edit_state = 'synced') AND synced_at < ?`,
          [userId, now],
        )
      }
    })
  },

  async saveDetail(userId, audit) {
    await run(
      `INSERT INTO audits (
         id, user_id, flow_id, flow_version, flow_name, project_id, project_name,
         facility_id, facility_name, status, version, findings_count, created_at, updated_at,
         answers_json, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         flow_id = excluded.flow_id,
         flow_version = excluded.flow_version,
         flow_name = excluded.flow_name,
         project_id = COALESCE(excluded.project_id, audits.project_id),
         project_name = COALESCE(excluded.project_name, audits.project_name),
         facility_id = COALESCE(excluded.facility_id, audits.facility_id),
         facility_name = COALESCE(excluded.facility_name, audits.facility_name),
         status = CASE WHEN ${UNSENT_EDIT} THEN audits.status ELSE excluded.status END,
         version = CASE WHEN ${UNSENT_EDIT} THEN audits.version ELSE excluded.version END,
         findings_count = COALESCE(excluded.findings_count, audits.findings_count),
         created_at = COALESCE(excluded.created_at, audits.created_at),
         updated_at = CASE WHEN ${UNSENT_EDIT} THEN audits.updated_at ELSE excluded.updated_at END,
         answers_json = CASE WHEN ${UNSENT_EDIT}
                             THEN audits.answers_json ELSE excluded.answers_json END,
         synced_at = excluded.synced_at`,
      [
        audit.id,
        userId,
        audit.flowId || null,
        audit.flowVersion ?? null,
        audit.flowName || null,
        audit.projectId ?? null,
        audit.projectName ?? null,
        audit.facilityId ?? null,
        audit.facilityName ?? null,
        audit.status,
        audit.version,
        audit.findingsCount ?? null,
        audit.createdAt ?? null,
        audit.updatedAt ?? null,
        audit.answers ? JSON.stringify(audit.answers) : null,
        Date.now(),
      ],
    )
  },

  async saveEdit(userId, id, edit) {
    await run(
      `UPDATE audits
          SET answers_json = ?, deleted_step_ids_json = ?, changed_step_ids_json = ?,
              edited_at = ?, edit_state = 'pending'
        WHERE id = ? AND user_id = ?`,
      [
        JSON.stringify(edit.answers),
        JSON.stringify(edit.deletedStepIds),
        JSON.stringify(edit.changedStepIds),
        Date.now(),
        id,
        userId,
      ],
    )
  },

  async setEditState(userId, id, state, status) {
    await run(
      `UPDATE audits SET edit_state = ?, status = COALESCE(?, status) WHERE id = ? AND user_id = ?`,
      [state, status ?? null, id, userId],
    )
  },

  async setVersion(userId, id, version) {
    await run(`UPDATE audits SET version = ? WHERE id = ? AND user_id = ?`, [version, id, userId])
  },

  async replacePhotoUris(userId, id, map) {
    await withTransaction(async () => {
      const rows = await query<{ answers_json: string | null }>(
        `SELECT answers_json FROM audits WHERE id = ? AND user_id = ? LIMIT 1`,
        [id, userId],
      )
      const json = rows[0]?.answers_json
      if (!json) return
      // Reemplazo de strings exactos dentro del JSON: las URIs `file://` no llevan caracteres escapables
      let next = json
      for (const [from, to] of Object.entries(map))
        next = next.split(JSON.stringify(from)).join(JSON.stringify(to))
      if (next !== json) {
        await run(`UPDATE audits SET answers_json = ? WHERE id = ? AND user_id = ?`, [
          next,
          id,
          userId,
        ])
      }
    })
  },

  async ackEdit(userId, id, ack) {
    // Versión/estado del backend siempre; "synced" sólo si nadie volvió a editar mientras viajaba
    await run(
      `UPDATE audits SET version = ?, status = COALESCE(?, status) WHERE id = ? AND user_id = ?`,
      [ack.version, ack.status ?? null, id, userId],
    )
    const res = await run(
      `UPDATE audits
          SET edit_state = 'synced', deleted_step_ids_json = NULL, changed_step_ids_json = NULL
        WHERE id = ? AND user_id = ? AND edited_at = ? AND edit_state = 'pending'`,
      [id, userId, ack.editedAt],
    )
    return res.changes > 0
  },

  async listByFacility(userId, facilityId) {
    const rows = await query<AuditRow>(
      `SELECT ${COLUMNS} FROM audits
        WHERE user_id = ? AND facility_id = ?
        ORDER BY created_at DESC`,
      [userId, facilityId],
    )
    return rows.map(rowToAudit)
  },

  async getById(userId, id) {
    const rows = await query<AuditRow>(
      `SELECT ${COLUMNS} FROM audits WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId],
    )
    const row = rows[0]
    return row ? rowToAudit(row) : null
  },
}
