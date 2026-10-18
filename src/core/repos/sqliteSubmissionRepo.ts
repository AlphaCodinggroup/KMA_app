import { query, run } from '@shared/storage/db'
import type {
  SubmissionRepo,
  SubmissionId,
  SaveDraftInput,
  SubmissionSnapshot,
  SubmissionStatus,
  SubmissionPipeline,
  SubmissionSyncState,
} from '@entities/submission/ports'
import type {
  SubmissionDraft,
  SubmissionAnswer,
  FormAnswer,
  QuestionAnswer,
} from '@entities/submission/model'
import { PHOTO_FIELD_KEYS, photoUriOf } from '@entities/submission/lib/photos'
import { normalizeQuestionAnswerValue } from '@shared/lib/questionAnswers'

const STEP_ID_ALL = 'ALL'

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

type SubmissionRow = {
  id: string
  flow_id: string
  step_id: string
  payload_json: string
  has_files: number
  synced: number
  created_at: number
  status: SubmissionStatus
  last_error: string | null
  user_id: string | null
  updated_at: number | null
  audit_id: string | null
  server_version: number | null
  server_status: string | null
  pipeline: SubmissionPipeline
}

const SUBMISSION_COLUMNS =
  'id, flow_id, step_id, payload_json, has_files, synced, created_at, status, last_error, user_id, updated_at, audit_id, server_version, server_status, pipeline'

function rowToSnapshot(row: SubmissionRow): SubmissionSnapshot {
  const { draft, projectId, facilityId, version } = parsePayload(row)

  const snapshot: SubmissionSnapshot = {
    id: row.id,
    flowId: draft.flowId,
    title: draft.title,
    createdAt: draft.createdAt,
    answers: draft.answers,
    projectId,
    facilityId,
    version,
    synced: !!row.synced,
    hasFiles: !!row.has_files,
    status: row.status,
    pipeline: row.pipeline === 'v2' ? 'v2' : 'v1',
  }
  if (row.last_error !== null) snapshot.lastError = row.last_error
  if (row.user_id !== null) snapshot.userId = row.user_id
  if (row.updated_at !== null) snapshot.updatedAt = row.updated_at
  if (row.audit_id !== null) snapshot.auditId = row.audit_id
  if (row.server_version !== null) snapshot.serverVersion = row.server_version
  if (row.server_status !== null) snapshot.serverStatus = row.server_status

  return snapshot
}

// Payload guardado en `payload_json`.
type SubmissionPayloadV1 =
  | SubmissionDraft
  | {
      draft: SubmissionDraft
      projectId?: string | null | undefined
      facilityId?: string | null | undefined
      version?: string | null | undefined
    }

function normalizeLegacyDraftAnswers(
  answers: Record<string, SubmissionAnswer> | null | undefined,
): Record<string, SubmissionAnswer> {
  const normalizedAnswers = answers ?? {}
  const out: Record<string, SubmissionAnswer> = {}

  for (const [stepId, answer] of Object.entries(normalizedAnswers)) {
    if (!answer || answer.type !== 'Question') {
      out[stepId] = answer
      continue
    }

    const normalizedQuestionAnswer = normalizeQuestionAnswerValue(answer.answer)

    // Legacy compat:
    // - antes "UNSURE" se persistía como { type: 'Question', answer: null, option: null }
    // - los Select legacy usan answer:null pero con option poblada
    const shouldUpgradeLegacyUnsure =
      normalizedQuestionAnswer === null &&
      (answer.option === null || typeof answer.option === 'undefined')

    const nextQuestionAnswer: QuestionAnswer = {
      ...answer,
      answer: shouldUpgradeLegacyUnsure ? 'UNSURE' : normalizedQuestionAnswer,
    }

    out[stepId] = nextQuestionAnswer
  }

  return out
}

function parsePayload(row: SubmissionRow): {
  draft: SubmissionDraft
  projectId?: string | undefined
  facilityId?: string | undefined
  version?: string | undefined
} {
  let raw: unknown
  try {
    raw = row.payload_json ? JSON.parse(row.payload_json) : null
  } catch {
    raw = null
  }

  let draft: SubmissionDraft
  let projectId: string | undefined
  let facilityId: string | undefined
  let version: string | undefined

  if (raw && typeof raw === 'object' && 'draft' in raw) {
    const wrapped = raw as Extract<SubmissionPayloadV1, { draft: SubmissionDraft }>
    draft = wrapped.draft
    projectId = wrapped.projectId ?? undefined
    facilityId = wrapped.facilityId ?? undefined
    version = wrapped.version ?? undefined
  } else {
    draft = (raw || {}) as SubmissionDraft
  }

  // Normalizar createdAt a número, usando created_at de la fila como fallback
  let createdAt: number
  if (typeof draft.createdAt === 'number') {
    createdAt = draft.createdAt
  } else if (typeof draft.createdAt === 'string') {
    const ts = Date.parse(draft.createdAt)
    createdAt = Number.isNaN(ts) ? row.created_at : ts
  } else {
    createdAt = row.created_at
  }

  draft = {
    flowId: draft.flowId,
    title: draft.title,
    createdAt,
    answers: normalizeLegacyDraftAnswers(draft.answers),
  }

  return { draft, projectId, facilityId, version }
}

/**
 * Detecta si el draft tiene al menos una foto local (file://)
 * buscando en values.photo / values.photos de las respuestas de tipo Form.
 */
function hasDraftFiles(draft: SubmissionDraft): boolean {
  for (const ans of Object.values<SubmissionAnswer>(draft.answers ?? {})) {
    if (!ans || ans.type !== 'Form') continue
    const form = ans as FormAnswer
    const photos = [
      ...PHOTO_FIELD_KEYS.flatMap(k => (Array.isArray(form.values?.[k]) ? form.values[k] : [])),
    ] as unknown[]
    if (photos.some(p => photoUriOf(p).startsWith('file://'))) return true
  }
  return false
}

/**
 * Estructura que vamos a guardar en payload_json.
 * Hoy incluye sólo el draft, pero deja campo para projectId/facilityId/version.
 */
function buildPayload(input: SaveDraftInput): SubmissionPayloadV1 {
  const { draft, projectId, facilityId, version } = input
  return {
    draft,
    projectId: projectId ?? null,
    facilityId: facilityId ?? null,
    version: version ?? null,
  }
}

export type FailedSubmissionSummary = { id: string; title: string; lastError: string | null }

export const sqliteSubmissionRepo: SubmissionRepo & {
  assignOwner(userId: string): Promise<void>
  listFailedSummaries(userId: string): Promise<FailedSubmissionSummary[]>
  listPendingWithFiles(status: SubmissionStatus): Promise<SubmissionSnapshot[]>
} = {
  async saveDraft(input: SaveDraftInput): Promise<{ id: SubmissionId }> {
    const id: SubmissionId = input.id ?? generateId()
    const payload = buildPayload(input)
    const hasFiles = hasDraftFiles(input.draft) ? 1 : 0

    const createdAt =
      typeof input.draft.createdAt === 'number' && !Number.isNaN(input.draft.createdAt)
        ? input.draft.createdAt
        : Date.now()

    const now = Date.now()

    // Si viene id, intentamos UPDATE primero (manteniendo created_at y status originales)
    if (input.id) {
      const updateRes = await run(
        `
        UPDATE submissions
        SET
          flow_id = ?,
          step_id = ?,
          payload_json = ?,
          has_files = ?,
          synced = 0,
          updated_at = ?
        WHERE id = ?
        `,
        [input.draft.flowId, STEP_ID_ALL, JSON.stringify(payload), hasFiles, now, input.id],
      )

      if (updateRes.changes > 0) {
        return { id: input.id }
      }
      // Si no existía, caemos al INSERT usando ese mismo id
    }

    await run(
      `
        INSERT INTO submissions (
          id,
          flow_id,
          step_id,
          payload_json,
          has_files,
          synced,
          created_at,
          status,
          user_id,
          updated_at,
          audit_id,
          server_status,
          pipeline
        ) VALUES (?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.draft.flowId,
        STEP_ID_ALL,
        JSON.stringify(payload),
        hasFiles,
        createdAt,
        input.userId ?? null,
        now,
        input.auditId ?? null,
        input.auditId ? 'audit_in_progress' : null,
        input.auditId ? 'v2' : 'v1',
      ],
    )

    return { id }
  },

  async getById(id: SubmissionId): Promise<SubmissionSnapshot | null> {
    const rows = await query<SubmissionRow>(
      `SELECT ${SUBMISSION_COLUMNS} FROM submissions WHERE id = ?`,
      [id],
    )
    const row = rows[0]
    return row ? rowToSnapshot(row) : null
  },

  async listByStatus(status: SubmissionStatus, userId?: string): Promise<SubmissionSnapshot[]> {
    const rows = userId
      ? await query<SubmissionRow>(
          `SELECT ${SUBMISSION_COLUMNS} FROM submissions
           WHERE status = ? AND user_id = ?
           ORDER BY created_at DESC`,
          [status, userId],
        )
      : await query<SubmissionRow>(
          `SELECT ${SUBMISSION_COLUMNS} FROM submissions
           WHERE status = ?
           ORDER BY created_at DESC`,
          [status],
        )
    return rows.map(rowToSnapshot)
  },

  async findDraft(params: {
    flowId: string
    projectId?: string
    facilityId?: string
    userId?: string
  }): Promise<SubmissionSnapshot | null> {
    // projectId/facilityId viven en el payload (se guardan '' cuando no hay)
    const args: (string | number)[] = [
      params.flowId,
      params.projectId ?? '',
      params.facilityId ?? '',
    ]
    let userClause = ''
    if (params.userId) {
      userClause = 'AND user_id = ?'
      args.push(params.userId)
    }

    const rows = await query<SubmissionRow>(
      `SELECT ${SUBMISSION_COLUMNS} FROM submissions
       WHERE status = 'draft' AND flow_id = ?
         AND COALESCE(json_extract(payload_json, '$.projectId'), '') = ?
         AND COALESCE(json_extract(payload_json, '$.facilityId'), '') = ?
         ${userClause}
       ORDER BY COALESCE(updated_at, created_at) DESC
       LIMIT 1`,
      args,
    )
    const row = rows[0]
    return row ? rowToSnapshot(row) : null
  },

  /** Fallidas del usuario sin parsear el payload completo (sólo título y último error). */
  async listFailedSummaries(userId: string): Promise<FailedSubmissionSummary[]> {
    const rows = await query<{ id: string; title: string | null; last_error: string | null }>(
      `SELECT id, json_extract(payload_json, '$.draft.title') AS title, last_error
         FROM submissions
        WHERE status = 'failed' AND user_id = ?
        ORDER BY created_at DESC`,
      [userId],
    )
    return rows.map(r => ({ id: r.id, title: r.title ?? '', lastError: r.last_error }))
  },

  /** Submissions con fotos locales en el estado dado (evita parsear las que no tienen archivos). */
  async listPendingWithFiles(status: SubmissionStatus): Promise<SubmissionSnapshot[]> {
    const rows = await query<SubmissionRow>(
      `SELECT ${SUBMISSION_COLUMNS} FROM submissions
        WHERE status = ? AND has_files = 1
        ORDER BY created_at DESC`,
      [status],
    )
    return rows.map(rowToSnapshot)
  },

  async markStatus(id: SubmissionId, status: SubmissionStatus, lastError?: string): Promise<void> {
    await run('UPDATE submissions SET status = ?, last_error = ?, updated_at = ? WHERE id = ?', [
      status,
      lastError ?? null,
      Date.now(),
      id,
    ])
  },

  async getSyncState(id: SubmissionId): Promise<SubmissionSyncState | null> {
    const rows = await query<{
      pipeline: SubmissionPipeline
      server_version: number | null
      answer_sync_json: string | null
      deleted_step_ids_json: string | null
    }>(
      `SELECT pipeline, server_version, answer_sync_json, deleted_step_ids_json
         FROM submissions WHERE id = ?`,
      [id],
    )
    const row = rows[0]
    if (!row) return null
    return {
      pipeline: row.pipeline === 'v2' ? 'v2' : 'v1',
      serverVersion: row.server_version,
      answerSyncJson: row.answer_sync_json,
      deletedStepIdsJson: row.deleted_step_ids_json,
    }
  },

  async saveSyncState(
    id: SubmissionId,
    state: { answerSyncJson?: string | null; deletedStepIdsJson?: string | null },
  ): Promise<void> {
    const sets: string[] = []
    const args: (string | number | null)[] = []
    if (state.answerSyncJson !== undefined) {
      sets.push('answer_sync_json = ?')
      args.push(state.answerSyncJson)
    }
    if (state.deletedStepIdsJson !== undefined) {
      sets.push('deleted_step_ids_json = ?')
      args.push(state.deletedStepIdsJson)
    }
    if (sets.length === 0) return
    await run(`UPDATE submissions SET ${sets.join(', ')} WHERE id = ?`, [...args, id])
  },

  async markServerState(
    id: SubmissionId,
    state: { serverVersion: number; serverStatus?: string },
  ): Promise<void> {
    await run(
      `UPDATE submissions
          SET server_version = ?, server_status = COALESCE(?, server_status), updated_at = ?
        WHERE id = ?`,
      [state.serverVersion, state.serverStatus ?? null, Date.now(), id],
    )
  },

  async markSynced(id: SubmissionId): Promise<void> {
    await run('UPDATE submissions SET synced = 1 WHERE id = ?', [id])
  },

  async delete(id: SubmissionId): Promise<void> {
    await run('DELETE FROM submissions WHERE id = ?', [id])
  },

  /** Backfill: asigna al usuario las submissions sin dueño (filas previas a la migración 4). */
  async assignOwner(userId: string): Promise<void> {
    await run('UPDATE submissions SET user_id = ? WHERE user_id IS NULL', [userId])
  },
}
