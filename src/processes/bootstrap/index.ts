import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { initDatabase } from '@shared/storage/db'
import { registerBackgroundSync, unregisterBackgroundSync } from '@shared/workers/background'
import { initSession, subscribe } from '@shared/session/session'
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

// Dispatcher mínimo
async function dispatchItem(_item: OutboxItem) {
  // TODO: implementar envío real (HTTP + idempotencia)
  return 'success' as const
}

const sync = new SyncService({ outbox: NoopOutboxRepo, dispatch: dispatchItem })

export async function bootstrapApp(): Promise<void> {
  if (_bootPromise) return _bootPromise

  _bootPromise = (async () => {
    // Infra base primero
    await initDatabase()

    // Rehidratación de sesión
    await initSession()

    // Triggers de ciclo de vida → encolar sync
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') sync.queue()
    })

    const netUnsub = NetInfo.addEventListener(state => {
      if (state.isConnected) sync.queue()
    })

    // Eventos de sesión: encolar sync en login/refresh. En logout, limpiar procesos si hace falta
    const unsubSession = subscribe(e => {
      if (e.type === 'login' || e.type === 'refresh') {
        sync.queue()
      }
      if (e.type === 'logout') {
        // En caso de implementar workers dependientes de sesión, cancelarlos aquí
      }
    })

    // Background fetch
    await registerBackgroundSync(() => sync.runOnce())

    // Cleanup centralizado
    _cleanup = () => {
      appStateSub.remove()
      netUnsub && netUnsub()
      unsubSession()
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
