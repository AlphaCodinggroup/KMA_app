import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { initDatabase } from '@shared/storage/db'
import { readJsonSecure } from '@shared/storage/secure'
import { registerBackgroundSync, unregisterBackgroundSync } from '@shared/workers/background'
import { setSessionTokens } from '@shared/session/session'
import { SyncService, type OutboxRepo, type OutboxItem } from '@processes/sync/SyncService'

let _bootPromise: Promise<void> | null = null
let _cleanup: (() => void) | null = null

// Repo mínimo mientras no hay backend real
const NoopOutboxRepo: OutboxRepo = {
  async nextBatch(_limit: number): Promise<OutboxItem[]> {
    return []
  },
  async markSuccess(_id: string) {
    /* noop */
  },
  async markFailure(_id: string, _reason?: string) {
    /* noop */
  },
}

// Dispatcher mínimo (cuando haya backend: inyectar aquí)
async function dispatchItem(_item: OutboxItem) {
  // TODO: implementar envío real (HTTP + idempotencia)
  return 'success' as const
}

const sync = new SyncService({
  outbox: NoopOutboxRepo,
  dispatch: dispatchItem,
})

export async function bootstrapApp(): Promise<void> {
  if (_bootPromise) return _bootPromise

  _bootPromise = (async () => {
    await initDatabase()

    // Rehidratación de sesión (login sigue desactivado, dejamos tokens si existieran)
    const storedTokens = await readJsonSecure('sessionTokens').catch(() => null)
    setSessionTokens(storedTokens ?? {})

    // Triggers de ciclo de vida
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') sync.queue()
    })

    const netUnsub = NetInfo.addEventListener(state => {
      if (state.isConnected) sync.queue()
    })

    await registerBackgroundSync(() => sync.runOnce())

    _cleanup = () => {
      appStateSub.remove()
      netUnsub && netUnsub()
      unregisterBackgroundSync().catch(() => void 0)
    }

    // Disparo inicial
    sync.queue()
  })()

  return _bootPromise
}

export function cleanupBootstrap() {
  _cleanup?.()
  _bootPromise = null
}
