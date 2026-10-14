import { Env } from '@shared/config/env'

/** Backoff del outbox: independiente del retry de axios (`Env.retry`). */
export const OUTBOX_BACKOFF_BASE_MS = 60_000
export const OUTBOX_BACKOFF_MAX_MS = 30 * 60_000
export const OUTBOX_MAX_ATTEMPTS = 15

export type OutboxItem = { id: string; type: string; payload?: unknown; attempts: number }
export interface OutboxRepo {
  /** Items `pending` del usuario cuyo backoff ya venció, del más viejo al más nuevo. */
  nextBatch(limit: number, now: number, userId: string): Promise<OutboxItem[]>
  markSuccess(id: string): Promise<void>
  /** Suma un intento y agenda el próximo para `nextAttemptAt` (epoch ms). */
  markRetry(id: string, nextAttemptAt: number, reason?: string): Promise<void>
  /** Estado final: la fila se conserva con `status = 'failed'`. */
  markFailed(id: string, reason: string): Promise<void>
  /** Limpia el backoff de todos los items `pending`. */
  resetBackoff(): Promise<void>
  /** Posterga un item sin sumar intentos (p. ej. un tipo que esta versión de la app no sabe procesar). */
  defer(id: string, nextAttemptAt: number): Promise<void>
}

/**
 * - success / drop: el item se borra de la cola.
 * - retry: suma un intento y aplica backoff.
 * - fail: queda `failed` (se conserva).
 * - defer: se posterga sin sumar intentos ni fallar.
 */
type DispatchResult = 'success' | 'retry' | 'fail' | 'drop' | 'defer'
type Dispatcher = (item: OutboxItem) => Promise<DispatchResult>

export type SyncServiceOpts = {
  outbox: OutboxRepo
  dispatch?: Dispatcher
  /** Usuario de la sesión actual; sin usuario no se drena la cola. */
  getUserId: () => string | null
  /** Conectividad real. Sin red no se procesa nada: así los intentos no se consumen estando offline. */
  isOnline?: () => Promise<boolean>
  /** Se invoca cuando un item pasa a `failed` (resultado `fail` o tope de intentos). */
  onFailed?: (item: OutboxItem, reason: string) => Promise<void>
  batchSize?: number
  backoffBaseMs?: number
  backoffMaxMs?: number
  maxAttempts?: number
}

export class SyncService {
  private running = false
  private queued = false
  private resetRequested = false
  private wakeTimer: ReturnType<typeof setTimeout> | null = null
  private wakeAt = 0

  private readonly outbox: OutboxRepo
  private readonly dispatch: Dispatcher
  private readonly getUserId: () => string | null
  private readonly isOnline: (() => Promise<boolean>) | undefined
  private readonly onFailed: ((item: OutboxItem, reason: string) => Promise<void>) | undefined
  private readonly batchSize: number
  private readonly backoffBaseMs: number
  private readonly backoffMaxMs: number
  readonly maxAttempts: number

  constructor(opts: SyncServiceOpts) {
    this.outbox = opts.outbox
    this.dispatch = opts.dispatch ?? (async () => 'success') // mientras no hay backend
    this.getUserId = opts.getUserId
    this.isOnline = opts.isOnline
    this.onFailed = opts.onFailed
    this.batchSize = opts.batchSize ?? Env.sync.batchSize
    this.backoffBaseMs = opts.backoffBaseMs ?? OUTBOX_BACKOFF_BASE_MS
    this.backoffMaxMs = opts.backoffMaxMs ?? OUTBOX_BACKOFF_MAX_MS
    this.maxAttempts = opts.maxAttempts ?? OUTBOX_MAX_ATTEMPTS
  }

  /** Cola una corrida segura. */
  queue(opts?: { resetBackoff?: boolean }) {
    // El backoff vive en SQLite: se limpia al comienzo de la próxima pasada.
    if (opts?.resetBackoff) this.resetRequested = true

    if (this.running) {
      this.queued = true
      return
    }
    this.running = true
    this.run()
      .catch(err => {
        // Un fallo de SQLite no debe quedar como promesa rechazada sin manejar
        if (__DEV__) console.warn('[SyncService] run falló', err)
      })
      .finally(() => {
        this.running = false
        if (this.queued) {
          this.queued = false
          this.queue()
        }
      })
  }

  /** Expuesto para background: ejecutar una pasada. */
  async runOnce() {
    if (this.running) return
    this.running = true
    try {
      await this.run()
    } finally {
      this.running = false
    }
  }

  /** Tope de lotes por corrida: protege contra un loop si un dispatcher nunca saca items de la cola. */
  private static readonly MAX_BATCHES_PER_RUN = 50

  private async run() {
    if (this.resetRequested) {
      this.resetRequested = false
      await this.outbox.resetBackoff()
    }

    // Sólo se drena con el token del dueño: los items de otro usuario esperan a que vuelva.
    const userId = this.getUserId()
    if (!userId) return

    // Sin red no se despacha: un intento offline no es un fallo del item.
    if (this.isOnline && !(await this.isOnline())) return

    // Se drenan lotes hasta vaciar lo que está listo. Los items reintentados o postergados quedan con
    // `next_attempt_at` a futuro, así que no vuelven a entrar en la misma corrida.
    for (let i = 0; i < SyncService.MAX_BATCHES_PER_RUN; i++) {
      const items = await this.outbox.nextBatch(this.batchSize, Date.now(), userId)
      if (!items.length) return

      for (const item of items) {
        await this.process(item)
      }
    }
  }

  private async process(item: OutboxItem) {
    try {
      const result = await this.dispatch(item)

      if (result === 'success' || result === 'drop') {
        await this.outbox.markSuccess(item.id)
      } else if (result === 'fail') {
        await this.markItemFailed(item, 'dispatch_failed')
      } else if (result === 'defer') {
        const delayMs = this.backoffMaxMs
        await this.outbox.defer(item.id, Date.now() + delayMs)
        this.scheduleWake(delayMs)
      } else {
        await this.handleRetry(item, 'retry')
      }
    } catch {
      await this.handleRetry(item, 'exception')
    }
  }

  private async markItemFailed(item: OutboxItem, reason: string) {
    await this.outbox.markFailed(item.id, reason)
    try {
      await this.onFailed?.(item, reason)
    } catch {
      // El callback es informativo: no debe romper el drenado de la cola.
    }
  }

  private async handleRetry(item: OutboxItem, reason: string) {
    if (item.attempts + 1 >= this.maxAttempts) {
      await this.markItemFailed(item, `${reason}: máximo de intentos (${this.maxAttempts})`)
      return
    }

    const delayMs = this.computeBackoffDelay(item.attempts)
    await this.outbox.markRetry(item.id, Date.now() + delayMs, reason)

    // Conveniencia: reprogramamos una corrida al vencer el backoff.
    this.scheduleWake(delayMs)
  }

  /**
   * Un solo timer para toda la cola, apuntando al próximo vencimiento. Si ya hay uno más cercano
   * se conserva. La verdad vive en SQLite: si el proceso muere, el siguiente trigger retoma.
   */
  private scheduleWake(delayMs: number) {
    const at = Date.now() + delayMs
    if (this.wakeTimer && this.wakeAt <= at) return

    if (this.wakeTimer) clearTimeout(this.wakeTimer)
    this.wakeAt = at
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null
      this.wakeAt = 0
      this.queue()
    }, delayMs)
  }

  private computeBackoffDelay(attempt: number): number {
    const jitter = Math.floor(Math.random() * this.backoffBaseMs)
    const expo = this.backoffBaseMs * Math.pow(2, attempt)
    return Math.min(expo, this.backoffMaxMs) + jitter
  }
}
