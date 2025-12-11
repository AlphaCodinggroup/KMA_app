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
          created_at
        ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
      `,
      [id, params.endpoint, method, payloadJson, filePathsJson, now],
    )

    return id
  },

  /**
   * Devuelve el siguiente lote de items a procesar, ordenados por created_at ASC.
   */
  async nextBatch(limit: number): Promise<OutboxItem[]> {
    const rows = await query<OutboxRow>(
      `
        SELECT
          id,
          endpoint,
          payload_json
        FROM outbox
        ORDER BY created_at ASC
        LIMIT ?
      `,
      [limit],
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
   * Falla: incrementamos attempts y dejamos trazado el último error textual.
   * La política de reintentos (max, backoff, etc.) la maneja SyncService.
   */
  async markFailure(id: string, reason?: string): Promise<void> {
    await run(
      `
        UPDATE outbox
        SET
          attempts = attempts + 1,
          last_error = COALESCE(?, last_error)
        WHERE id = ?
      `,
      [reason ?? null, id],
    )
  },
}
