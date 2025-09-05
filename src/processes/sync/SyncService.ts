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
  queue() {
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
      try {
        const result = await this.dispatch(item)
        if (result === 'success') {
          await this.outbox.markSuccess(item.id)
        } else if (result === 'drop') {
          await this.outbox.markFailure(item.id, 'dropped')
        } else {
          // retry: backoff básico
          await this.delay(this.retryBaseDelayMs)
          this.queued = true // reintentar en próxima corrida
        }
      } catch (e) {
        await this.outbox.markFailure(item.id, 'exception')
        this.queued = true // reintentar lote siguiente
      }
    }
  }

  private delay(ms: number) {
    return new Promise(res => setTimeout(res, ms))
  }
}
