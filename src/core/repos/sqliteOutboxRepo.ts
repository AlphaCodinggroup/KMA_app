import { query, run } from '@shared/storage/db'
import type { OutboxItem, OutboxRepo } from '@processes/sync/SyncService'

/**
 * Row real en SQLite para la tabla `outbox`.
 * Debe respetar exactamente el esquema definido en migrations.ts
 */
type OutboxRow = {
  id: string
  endpoint: string
  method: string
  payload_json: string
  file_paths_json: string | null
  attempts: number
  last_error: string | null
  created_at: number
}

/**
 * Payload genérico que se guarda en el outbox.
 * Para el caso de auditorías, típicamente será algo como:
 * { submissionId: string; filePaths: string[] }
 */
export type OutboxPayload = unknown

export type EnqueueParams = {
  /**
   * Identificador lógico del tipo de operación.
   * Podés usar un endpoint real (ej: "/audits") o un tipo de dominio
   * (ej: "AUDIT_SUBMISSION"). Esto es lo que luego llega como `item.type`
   * al dispatcher del SyncService.
   */
  endpoint: string
  /**
   * "Semántica" del método. Para HTTP puede ser "POST"/"PUT"/etc.
   * Para operaciones de dominio podés usar algo como "USECASE".
   */
  method?: string
  payload?: OutboxPayload
  /**
   * Paths locales de archivos asociados (fotos, etc.).
   * Se guardan también en file_paths_json para facilitar limpieza.
   */
  filePaths?: string[]
  /** Permite forzar un id (por ejemplo, si querés idempotencia). */
  id?: string
  /** Usuario dueño del item (para filtrar al cambiar de sesión). */
  userId?: string
  /** Id de otro item del outbox: este no se procesa mientras aquel siga en la tabla. */
  dependsOn?: string
}

/** Id simple sin dependencias externas. Alcanzan unicidad y orden aproximado. */
function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    // En el peor caso guarda algo serializable para no romper el insert
    return JSON.stringify({ error: 'serialize_failed' })
  }
}

export const sqliteOutboxRepo: OutboxRepo & {
  enqueue(params: EnqueueParams): Promise<string>
  enqueueUnique(params: EnqueueParams & { id: string }): Promise<void>
  requeue(id: string): Promise<void>
  requeueBySubmissionId(submissionId: string): Promise<boolean>
  hasSubmissionItem(submissionId: string, endpoint: string): Promise<boolean>
  markFailedBySubmissionId(submissionId: string, reason: string): Promise<boolean>
  countPending(userId?: string): Promise<number>
  assignOwner(userId: string): Promise<void>
} = {
  /**
   * Encola un nuevo item en la tabla `outbox`.
   * Devuelve el id generado para poder referenciarlo luego si hace falta.
   */
  async enqueue(params: EnqueueParams): Promise<string> {
    const id = params.id ?? generateId()
    const payloadJson = safeStringify(params.payload)
    const filePathsJson =
      params.filePaths && params.filePaths.length ? safeStringify(params.filePaths) : null
    const now = Date.now()

    const method = params.method ?? 'USECASE'

    await run(
      `
        INSERT INTO outbox (
          id,
          endpoint,
          method,
          payload_json,
          file_paths_json,
          attempts,
          last_error,
          created_at,
          user_id,
          depends_on
        ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
      `,
      [
        id,
        params.endpoint,
        method,
        payloadJson,
        filePathsJson,
        now,
        params.userId ?? null,
        params.dependsOn ?? null,
      ],
    )

    return id
  },

  /**
   * Encola un item con id fijo sin duplicarlo (coalesce): si ya existe y está `pending` no hace
   * nada (el que está en cola lee el estado más reciente al correr); si quedó `failed`, lo
   * re-arma para que un cambio nuevo vuelva a intentarse.
   */
  async enqueueUnique(params: EnqueueParams & { id: string }): Promise<void> {
    const read = async () => {
      const rows = await query<{ status: string }>(`SELECT status FROM outbox WHERE id = ?`, [
        params.id,
      ])
      return rows[0]
    }

    let existing = await read()

    if (!existing) {
      try {
        await this.enqueue(params)
        return
      } catch (err) {
        // Otra llamada concurrente insertó el mismo id entre la lectura y el INSERT: se trata
        // como "ya existe". Si la fila sigue sin estar, el error era otro.
        existing = await read()
        if (!existing) throw err
      }
    }
    if (existing.status === 'failed') {
      await run(
        `UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = NULL WHERE id = ?`,
        [params.id],
      )
    }
  },

  /**
   * Devuelve el siguiente lote de items a procesar, ordenados por created_at ASC.
   * Sólo `pending` del usuario indicado y con backoff vencido: los `failed` o en espera no ocupan lote.
   */
  async nextBatch(limit: number, now: number, userId: string): Promise<OutboxItem[]> {
    const rows = await query<OutboxRow>(
      `
        SELECT
          id,
          endpoint,
          payload_json,
          attempts
        FROM outbox
        WHERE status = 'pending'
          AND user_id = ?
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
          AND (
            depends_on IS NULL
            OR NOT EXISTS (SELECT 1 FROM outbox dep WHERE dep.id = outbox.depends_on)
          )
        ORDER BY created_at ASC
        LIMIT ?
      `,
      [userId, now, limit],
    )

    return rows.map(row => {
      let payload: unknown
      try {
        payload = row.payload_json ? JSON.parse(row.payload_json) : undefined
      } catch {
        payload = undefined
      }

      return {
        id: row.id,
        // Usamos endpoint como `type` hacia el SyncService/dispatcher
        type: row.endpoint,
        payload,
        attempts: row.attempts,
      }
    })
  },

  /**
   * Éxito: borramos el item del outbox.
   * La limpieza de archivos asociados se hace en el dispatcher, no aquí.
   */
  async markSuccess(id: string): Promise<void> {
    await run(`DELETE FROM outbox WHERE id = ?`, [id])
  },

  /**
   * Reintento: suma un intento, deja el motivo y agenda el próximo para `nextAttemptAt`.
   * El backoff queda persistido: sobrevive a que se mate la app.
   */
  async markRetry(id: string, nextAttemptAt: number, reason?: string): Promise<void> {
    await run(
      `
        UPDATE outbox
        SET
          attempts = attempts + 1,
          next_attempt_at = ?,
          last_error = COALESCE(?, last_error)
        WHERE id = ?
      `,
      [nextAttemptAt, reason ?? null, id],
    )
  },

  /**
   * Marca el item como fallido definitivo: queda en la tabla (no se borra)
   * con el motivo, y deja de ser candidato a reintento hasta un `requeue`.
   */
  async markFailed(id: string, reason: string): Promise<void> {
    await run(
      `UPDATE outbox SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?`,
      [reason, id],
    )
  },

  /** Posterga el item sin tocar `attempts`. */
  async defer(id: string, nextAttemptAt: number): Promise<void> {
    await run(`UPDATE outbox SET next_attempt_at = ? WHERE id = ?`, [nextAttemptAt, id])
  },

  /**
   * Marca como fallido el item AUDIT_SUBMISSION de una submission (cuando los datos locales ya
   * no permiten enviarla, p. ej. falta una foto). Devuelve false si no había fila.
   */
  async markFailedBySubmissionId(submissionId: string, reason: string): Promise<boolean> {
    const res = await run(
      `
        UPDATE outbox
        SET status = 'failed', last_error = ?
        WHERE endpoint IN ('AUDIT_SUBMISSION', 'AUDIT_SUBMIT')
          AND json_extract(payload_json, '$.submissionId') = ?
      `,
      [reason, submissionId],
    )
    return res.changes > 0
  },

  async resetBackoff(): Promise<void> {
    await run(`UPDATE outbox SET next_attempt_at = NULL WHERE status = 'pending'`)
  },

  /** Devuelve un item a `pending` con intentos y backoff reiniciados. */
  async requeue(id: string): Promise<void> {
    await run(
      `UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = NULL WHERE id = ?`,
      [id],
    )
  },

  /**
   * Re-encola el item AUDIT_SUBMISSION de una submission fallida.
   * Devuelve false si no existe fila en el outbox para ese submissionId.
   */
  async requeueBySubmissionId(submissionId: string): Promise<boolean> {
    const res = await run(
      `
        UPDATE outbox
        SET status = 'pending', attempts = 0, next_attempt_at = NULL
        WHERE json_extract(payload_json, '$.submissionId') = ?
      `,
      [submissionId],
    )
    return res.changes > 0
  },

  /** ¿Hay un item (en cualquier estado) de ese tipo para la submission? */
  async hasSubmissionItem(submissionId: string, endpoint: string): Promise<boolean> {
    const rows = await query<{ n: number }>(
      `SELECT 1 AS n FROM outbox
        WHERE endpoint = ? AND json_extract(payload_json, '$.submissionId') = ? LIMIT 1`,
      [endpoint, submissionId],
    )
    return rows.length > 0
  },

  /** Backfill: asigna al usuario los items sin dueño (filas previas a la migración 4). */
  async assignOwner(userId: string): Promise<void> {
    await run(`UPDATE outbox SET user_id = ? WHERE user_id IS NULL`, [userId])
  },

  /** Cantidad de items `pending`, opcionalmente de un solo usuario. */
  async countPending(userId?: string): Promise<number> {
    const rows = userId
      ? await query<{ n: number }>(
          `SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending' AND user_id = ?`,
          [userId],
        )
      : await query<{ n: number }>(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'`)
    return rows[0]?.n ?? 0
  },
}
