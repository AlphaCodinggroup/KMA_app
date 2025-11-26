import { query, run } from '@shared/storage/db'
import type {
  SubmissionRepo,
  SubmissionId,
  SaveDraftInput,
  SubmissionSnapshot,
} from '@entities/submission/ports'
import type { SubmissionDraft, SubmissionAnswer, FormAnswer } from '@entities/submission/model'

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
}

// Payload guardado en `payload_json`.
type SubmissionPayloadV1 =
  | SubmissionDraft
  | {
      draft: SubmissionDraft
      projectId?: string | null
      facilityId?: string | null
      version?: string | null
    }

function parsePayload(row: SubmissionRow): {
  draft: SubmissionDraft
  projectId?: string
  facilityId?: string
  version?: string
} {
  let raw: any
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
    draft = raw.draft as SubmissionDraft
    projectId = raw.projectId ?? undefined
    facilityId = raw.facilityId ?? undefined
    version = raw.version ?? undefined
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
    answers: draft.answers ?? {},
  }

  return { draft, projectId, facilityId, version }
}

/**
 * Detecta si el draft tiene al menos una foto local (file://)
 * buscando en values.photo / values.photos de las respuestas de tipo Form.
 */
function hasDraftFiles(draft: SubmissionDraft): boolean {
  const answers = draft.answers ?? {}
  for (const ans of Object.values<SubmissionAnswer>(answers)) {
    if (!ans || ans.type !== 'Form') continue
    const form = ans as FormAnswer
    const values = form.values ?? {}

    const maybePhotos: unknown[] = []

    const vPhoto = values.photo
    const vPhotos = values.photos

    if (Array.isArray(vPhoto)) maybePhotos.push(...vPhoto)
    if (Array.isArray(vPhotos)) maybePhotos.push(...vPhotos)

    if (!maybePhotos.length) continue

    const hasLocal = maybePhotos.some(p => {
      if (typeof p === 'string') return p.startsWith('file://')
      if (p && typeof p === 'object') {
        const uri = (p as any).uri || (p as any).localUri
        return typeof uri === 'string' && uri.startsWith('file://')
      }
      return false
    })

    if (hasLocal) return true
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

export const sqliteSubmissionRepo: SubmissionRepo = {
  async saveDraft(input: SaveDraftInput): Promise<{ id: SubmissionId }> {
    const id: SubmissionId = input.id ?? generateId()
    const payload = buildPayload(input)
    const hasFiles = hasDraftFiles(input.draft) ? 1 : 0

    const createdAt =
      typeof input.draft.createdAt === 'number' && !Number.isNaN(input.draft.createdAt)
        ? input.draft.createdAt
        : Date.now()

    // Si viene id, intentamos UPDATE primero (manteniendo created_at original)
    if (input.id) {
      const updateRes = await run(
        `
        UPDATE submissions
        SET
          flow_id = ?,
          step_id = ?,
          payload_json = ?,
          has_files = ?,
          synced = 0
        WHERE id = ?
        `,
        [input.draft.flowId, STEP_ID_ALL, JSON.stringify(payload), hasFiles, input.id],
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
          created_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?)
      `,
      [id, input.draft.flowId, STEP_ID_ALL, JSON.stringify(payload), hasFiles, createdAt],
    )

    return { id }
  },

  async getById(id: SubmissionId): Promise<SubmissionSnapshot | null> {
    const rows = await query<SubmissionRow>(
      'SELECT id, flow_id, step_id, payload_json, has_files, synced, created_at FROM submissions WHERE id = ?',
      [id],
    )
    const row = rows[0]
    if (!row) return null

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
    }

    return snapshot
  },

  async markSynced(id: SubmissionId): Promise<void> {
    await run('UPDATE submissions SET synced = 1 WHERE id = ?', [id])
  },

  async delete(id: SubmissionId): Promise<void> {
    await run('DELETE FROM submissions WHERE id = ?', [id])
  },
}
