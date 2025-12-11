export type OutboxItem = { id: string; type: string; payload?: unknown }
export interface OutboxRepo {
  nextBatch(limit: number): Promise<OutboxItem[]>
  markSuccess(id: string): Promise<void>
  markFailure(id: string, reason?: string): Promise<void>
}

type DispatchResult = 'success' | 'retry' | 'drop'
type Dispatcher = (item: OutboxItem) => Promise<DispatchResult>

export type SyncServiceOpts = {
  outbox: OutboxRepo
  dispatch?: Dispatcher
  batchSize?: number
  retryBaseDelayMs?: number
  retryMaxAttempts?: number
}

export class SyncService {
  private running = false
  private queued = false
  private readonly retryAttempts = new Map<string, number>()
  private readonly retryCooldowns = new Map<string, number>()

  private readonly outbox: OutboxRepo
  private readonly dispatch: Dispatcher
  private readonly batchSize: number
  private readonly retryBaseDelayMs: number
  private readonly retryMaxAttempts: number

  constructor(opts: SyncServiceOpts) {
    this.outbox = opts.outbox
    this.dispatch = opts.dispatch ?? (async () => 'success') // mientras no hay backend
    this.batchSize = opts.batchSize ?? (Number(process.env.EXPO_PUBLIC_SYNC_BATCH_SIZE) || 10)
    this.retryBaseDelayMs =
      opts.retryBaseDelayMs ?? (Number(process.env.EXPO_PUBLIC_RETRY_BASE_DELAY_MS) || 1000)
    this.retryMaxAttempts =
      opts.retryMaxAttempts ?? (Number(process.env.EXPO_PUBLIC_RETRY_MAX_ATTEMPTS) || 5)
  }

  /** Cola una corrida segura. */
  queue(opts?: { resetBackoff?: boolean }) {
    if (opts?.resetBackoff) {
      this.retryAttempts.clear()
      this.retryCooldowns.clear()
    }

    if (this.running) {
      this.queued = true
      return
    }
    this.running = true
    this.run().finally(() => {
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

  private async run() {
    // Pedimos lote a outbox
    const items = await this.outbox.nextBatch(this.batchSize)
    if (!items.length) return

    //  Procesamos uno a uno
    for (const item of items) {
      const attempt = this.retryAttempts.get(item.id) ?? 0
      const cooldownUntil = this.retryCooldowns.get(item.id)
      if (cooldownUntil && cooldownUntil > Date.now()) {
        // Ya hay un backoff programado: saltamos este item en esta pasada.
        continue
      }

      try {
        const result = await this.dispatch(item)

        if (result === 'success' || result === 'drop') {
          await this.outbox.markSuccess(item.id)
          this.retryAttempts.delete(item.id)
          this.retryCooldowns.delete(item.id)
        } else {
          await this.handleRetry(item.id, attempt, 'retry')
        }
      } catch (e) {
        await this.handleRetry(item.id, attempt, 'exception')
      }
    }
  }

  private async handleRetry(id: string, attempt: number, reason?: string) {
    const nextAttempt = attempt + 1
    this.retryAttempts.set(id, nextAttempt)
    const delayMs = this.computeBackoffDelay(attempt)
    const wakeAt = Date.now() + delayMs
    this.retryCooldowns.set(id, wakeAt)

    await this.outbox.markFailure(id, reason ?? 'retry')

    // Reprogramamos una corrida cuando pase el backoff.
    setTimeout(() => this.queue(), delayMs)
  }

  private computeBackoffDelay(attempt: number): number {
    const cappedAttempt = Math.min(attempt, this.retryMaxAttempts)
    const jitter = Math.floor(Math.random() * this.retryBaseDelayMs)
    const expo = Math.pow(2, cappedAttempt)
    return this.retryBaseDelayMs * expo + jitter
  }
}
