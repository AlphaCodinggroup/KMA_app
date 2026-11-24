import { query, run } from '@shared/storage/db'
import { notifyPhotoSyncChanged } from '@shared/lib/photoSyncSignal'
import type { PhotoUploadRepo } from '@entities/photo/ports'
import type { PhotoUpload, PhotoUploadStatus } from '@entities/photo/model'

type PhotoUploadRow = {
  id: string
  submission_id: string
  audit_id: string | null
  step_id: string
  field_id: string
  local_uri: string
  upload_name: string
  remote_url: string | null
  s3_key: string | null
  upload_url: string | null
  expires_at: number | null
  status: PhotoUploadStatus
  attempts: number
  last_error: string | null
  created_at: number
  updated_at: number
}

const COLUMNS =
  'id, submission_id, audit_id, step_id, field_id, local_uri, upload_name, remote_url, s3_key, upload_url, expires_at, status, attempts, last_error, created_at, updated_at'

function rowToPhoto(row: PhotoUploadRow): PhotoUpload {
  return {
    id: row.id,
    submissionId: row.submission_id,
    auditId: row.audit_id ?? undefined,
    stepId: row.step_id,
    fieldId: row.field_id,
    localUri: row.local_uri,
    uploadName: row.upload_name,
    remoteUrl: row.remote_url ?? undefined,
    s3Key: row.s3_key ?? undefined,
    uploadUrl: row.upload_url ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const baseRepo: PhotoUploadRepo = {
  async register(photo) {
    const now = Date.now()
    await run(
      `INSERT OR IGNORE INTO photo_uploads (
         id, submission_id, audit_id, step_id, field_id, local_uri, upload_name,
         status, attempts, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [
        photo.id,
        photo.submissionId,
        photo.auditId ?? null,
        photo.stepId,
        photo.fieldId,
        photo.localUri,
        photo.uploadName,
        now,
        now,
      ],
    )
  },

  async getById(id) {
    const rows = await query<PhotoUploadRow>(`SELECT ${COLUMNS} FROM photo_uploads WHERE id = ?`, [
      id,
    ])
    const row = rows[0]
    return row ? rowToPhoto(row) : null
  },

  async listBySubmission(submissionId) {
    const rows = await query<PhotoUploadRow>(
      `SELECT ${COLUMNS} FROM photo_uploads WHERE submission_id = ? ORDER BY created_at ASC`,
      [submissionId],
    )
    return rows.map(rowToPhoto)
  },

  async listV2ForUser(userId) {
    const rows = await query<PhotoUploadRow>(
      `SELECT ${COLUMNS.split(', ')
        .map(c => `p.${c}`)
        .join(', ')}
         FROM photo_uploads p
         JOIN submissions s ON s.id = p.submission_id
        WHERE s.pipeline = 'v2' AND s.user_id = ?
        ORDER BY p.created_at ASC`,
      [userId],
    )
    return rows.map(rowToPhoto)
  },

  async requeueFailed(submissionId) {
    if (submissionId) {
      await run(
        `UPDATE photo_uploads SET status = 'pending', last_error = NULL, updated_at = ?
          WHERE status = 'failed' AND submission_id = ?`,
        [Date.now(), submissionId],
      )
    } else {
      await run(
        `UPDATE photo_uploads SET status = 'pending', last_error = NULL, updated_at = ?
          WHERE status = 'failed'`,
        [Date.now()],
      )
    }
  },

  async listByStatus(status, limit) {
    const rows = await query<PhotoUploadRow>(
      `SELECT ${COLUMNS} FROM photo_uploads WHERE status = ? ORDER BY created_at ASC${
        typeof limit === 'number' ? ' LIMIT ?' : ''
      }`,
      typeof limit === 'number' ? [status, limit] : [status],
    )
    return rows.map(rowToPhoto)
  },

  async savePresign(id, presign) {
    await run(
      `UPDATE photo_uploads
          SET upload_url = ?, remote_url = ?, expires_at = ?, updated_at = ?
        WHERE id = ? AND status != 'uploaded'`,
      [presign.uploadUrl, presign.remoteUrl, presign.expiresAt, Date.now(), id],
    )
  },

  async clearPresign(id) {
    await run(
      `UPDATE photo_uploads SET upload_url = NULL, expires_at = NULL, updated_at = ?
        WHERE id = ? AND status != 'uploaded'`,
      [Date.now(), id],
    )
  },

  async markUploading(id) {
    await run(`UPDATE photo_uploads SET status = 'uploading', updated_at = ? WHERE id = ?`, [
      Date.now(),
      id,
    ])
  },

  async markUploaded(id, remoteUrl) {
    await run(
      `UPDATE photo_uploads
          SET status = 'uploaded', remote_url = ?, last_error = NULL, updated_at = ?
        WHERE id = ?`,
      [remoteUrl, Date.now(), id],
    )
  },

  async markRetry(id, error) {
    await run(
      `UPDATE photo_uploads
          SET status = 'pending', attempts = attempts + 1, last_error = ?, updated_at = ?
        WHERE id = ? AND status != 'uploaded'`,
      [error, Date.now(), id],
    )
  },

  async markFailed(id, error) {
    await run(
      `UPDATE photo_uploads
          SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ?
        WHERE id = ? AND status != 'uploaded'`,
      [error, Date.now(), id],
    )
  },

  async resetUploading() {
    await run(
      `UPDATE photo_uploads SET status = 'pending', updated_at = ? WHERE status = 'uploading'`,
      [Date.now()],
    )
  },

  async deleteByLocalUri(localUri) {
    await run(`DELETE FROM photo_uploads WHERE local_uri = ?`, [localUri])
  },

  async deleteBySubmission(submissionId) {
    await run(`DELETE FROM photo_uploads WHERE submission_id = ?`, [submissionId])
  },

  async deletePendingByStepIds(submissionId, stepIds) {
    for (const stepId of stepIds) {
      await run(
        `DELETE FROM photo_uploads
          WHERE submission_id = ? AND step_id = ? AND status = 'pending'`,
        [submissionId, stepId],
      )
    }
  },
}

/** Envuelve una escritura: al terminar avisa a `photoSyncSignal` (la UI se refresca sola). */
const notifying =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    const result = await fn(...args)
    notifyPhotoSyncChanged()
    return result
  }

/**
 * Cada escritura que cambia lo visible avisa a `photoSyncSignal` (runner, uploader, bootstrap y
 * limpieza no tienen que acordarse). El presign no notifica: no tiene reflejo en la UI. Al estar
 * tipado método a método, un nombre mal escrito falla al compilar.
 */
export const sqlitePhotoUploadRepo: PhotoUploadRepo = {
  ...baseRepo,
  register: notifying(baseRepo.register),
  markUploading: notifying(baseRepo.markUploading),
  markUploaded: notifying(baseRepo.markUploaded),
  markRetry: notifying(baseRepo.markRetry),
  markFailed: notifying(baseRepo.markFailed),
  resetUploading: notifying(baseRepo.resetUploading),
  requeueFailed: notifying(baseRepo.requeueFailed),
  deleteByLocalUri: notifying(baseRepo.deleteByLocalUri),
  deleteBySubmission: notifying(baseRepo.deleteBySubmission),
  deletePendingByStepIds: notifying(baseRepo.deletePendingByStepIds),
}
