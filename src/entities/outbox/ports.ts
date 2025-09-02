import type { OutboxItem } from './model'

/**
 * @file Puerto de repositorio para la cola Outbox (offline-first).
 * Define las operaciones necesarias para persistir, leer y mantener
 * la cola de sincronización idempotente por `id` (UUID).
 */
export interface OutboxRepo {
  enqueue(item: OutboxItem): Promise<void>
  nextBatch(limit: number): Promise<OutboxItem[]>
  markSuccess(id: string): Promise<void>
  markFailure(id: string, errorMessage: string): Promise<void>
  purgeById(id: string): Promise<void>
}
