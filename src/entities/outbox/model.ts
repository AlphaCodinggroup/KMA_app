/**
 * Ítem de la cola Outbox para sincronización diferida (offline-first).
 * Se persiste localmente y el SyncService lo envía cuando hay conectividad.
 */
export type OutboxItem = {
  id: string
  type: 'formSubmit' | 'photoUpload' | string
  payload: unknown
  filePath?: string
  createdAt: number
  attempts: number
  lastError?: string | null
}
