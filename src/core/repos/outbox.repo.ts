/**
 * @file Repositorio Outbox basado en SQLite (Expo SDK 53, API async).
 * Implementa el puerto `OutboxRepo` usando `expo-sqlite` (métodos `runAsync`/`getAllAsync`).
 */

import type { OutboxRepo } from '@entities/outbox/ports'
import type { OutboxItem } from '@entities/outbox/model'
import { getDb } from './sqlite'

/** Fila cruda tal como viene de SQLite */
type OutboxRow = {
  id: string
  type: string
  payload: string // JSON serializado
  filePath: string | null
  createdAt: number
  attempts: number
  lastError: string | null
}

/** Mapea una fila de DB a `OutboxItem` de dominio */
function mapRowToItem(r: OutboxRow): OutboxItem {
  return {
    id: r.id,
    type: r.type, // compatible con 'formSubmit' | 'photoUpload' | string
    payload: JSON.parse(r.payload) as unknown,
    createdAt: r.createdAt,
    attempts: r.attempts,
    // Incluir solo si existen (no asignar undefined)
    ...(r.filePath != null ? { filePath: r.filePath } : {}),
    ...(r.lastError !== null ? { lastError: r.lastError } : {}),
  }
}

/**
 * Implementación SQLite del repositorio de outbox.
 */
export const sqliteOutboxRepo: OutboxRepo = {
  async enqueue(item: OutboxItem): Promise<void> {
    const db = await getDb()
    await db.runAsync(
      `INSERT OR REPLACE INTO outbox (id, type, payload, filePath, createdAt, attempts, lastError)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.type,
      JSON.stringify(item.payload),
      item.filePath ?? null,
      item.createdAt,
      item.attempts ?? 0,
      // si no existe, guardamos null en DB (no undefined)
      item.lastError ?? null,
    )
  },

  async nextBatch(limit: number): Promise<OutboxItem[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<OutboxRow>(
      `SELECT * FROM outbox ORDER BY createdAt ASC LIMIT ?`,
      [limit],
    )
    return rows.map(mapRowToItem)
  },

  async markSuccess(id: string): Promise<void> {
    const db = await getDb()
    await db.runAsync(`DELETE FROM outbox WHERE id = ?`, id)
  },

  async markFailure(id: string, msg: string): Promise<void> {
    const db = await getDb()
    await db.runAsync(
      `UPDATE outbox SET attempts = attempts + 1, lastError = ? WHERE id = ?`,
      msg,
      id,
    )
  },

  async purgeById(id: string): Promise<void> {
    // Evitamos `this` para no disparar la regla no-invalid-this
    await sqliteOutboxRepo.markSuccess(id)
  },
}
