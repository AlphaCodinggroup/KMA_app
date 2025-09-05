import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { initDatabase } from '@shared/storage/db'
import { readJsonSecure } from '@shared/storage/secure'
import { registerBackgroundSync, unregisterBackgroundSync } from '@shared/workers/background'
import {
  setSessionTokens,
  getAccessToken,
  refreshSessionTokens,
  loadSessionFromSecure,
} from '@shared/session/session' // NEW: suponiendo que existen
import { configureHttp } from '@shared/api/http' // NEW

/** Evita dobles arranques */
let _bootPromise: Promise<void> | null = null
let _cleanup: (() => void) | null = null

/** Sync: control de concurrencia y debounce */
let _syncRunning = false
let _syncQueued = false
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

// NEW: Cooldown anti-tormenta (evita syncs back-to-back desde múltiples triggers)
const SYNC_COOLDOWN_MS = 7000
let _lastSyncAt = 0

/** Clave de sesión en SecureStore */
const SECURE_SESSION_KEY = 'kma.session'

/** Helper: ejecuta un callback que puede devolver void o Promise<void>, manejando errores */
function runMaybePromise(fn?: () => void | Promise<void>) {
  try {
    const res = fn?.()
    if (res && typeof (res as any).then === 'function') {
      ;(res as Promise<void>).catch(e => {
        console.warn('[bootstrap] async listener error:', e)
      })
    }
  } catch (e) {
    console.warn('[bootstrap] listener error:', e)
  }
}

/** Arranque único de la app */
export async function bootstrapApp(): Promise<void> {
  if (_bootPromise) return _bootPromise

  _bootPromise = (async () => {
    await initDatabase()
    await rehydrateSessionSafe()
    await loadSessionFromSecure()

    configureHttp({
      getAccessToken: async () => getAccessToken(),
      refreshToken: async () => {
        const t = await refreshSessionTokens()
        return t?.accessToken
      },
      autoIdempotency: true,
    })

    _cleanup = registerLifecycleTriggers({
      onForeground: () => triggerSync('foreground'),
      onOnline: () => triggerSync('online'),
    })

    await safeRegisterBackground()

    triggerSync('startup').catch(e => console.warn('[bootstrap] startup sync error:', e))

    try {
      const ni = await NetInfo.fetch()
      if (ni.isConnected && ni.isInternetReachable !== false) {
        triggerSync('startup-online').catch(() => {})
      }
    } catch {}
  })().catch(e => {
    _bootPromise = null
    throw e
  })

  return _bootPromise
}

/** Relee sesión desde SecureStore y déjala disponible (placeholder) */
async function rehydrateSessionSafe() {
  try {
    const sess = await readJsonSecure<{ accessToken: string; refreshToken?: string }>(
      SECURE_SESSION_KEY,
    )
    if (sess?.accessToken) {
      setSessionTokens(sess)
      console.log('[bootstrap] sesión rehidratada')
    } else {
      console.log('[bootstrap] sin sesión previa')
    }
  } catch (e) {
    console.warn('[bootstrap] error rehidratando sesión:', e)
  }
}

/** Registra listeners de AppState/NetInfo */
function registerLifecycleTriggers({
  onForeground,
  onOnline,
}: {
  onForeground?: () => void | Promise<void>
  onOnline?: () => void | Promise<void>
}) {
  const appSub = AppState.addEventListener('change', state => {
    if (state === 'active') runMaybePromise(onForeground)
  })

  const netUnsub = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) {
      if (_debounceTimer) clearTimeout(_debounceTimer)
      _debounceTimer = setTimeout(() => {
        _debounceTimer = null
        runMaybePromise(onOnline)
      }, 400)
    }
  })

  return () => {
    try {
      appSub.remove()
    } catch {}
    try {
      netUnsub()
    } catch {}
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
  }
}

/** Background Task segura */
async function safeRegisterBackground() {
  try {
    await registerBackgroundSync(async () => {
      await triggerSync('background')
    })
    console.log('[bootstrap] background task registrada')
  } catch (e) {
    console.warn('[bootstrap] background task no disponible:', e)
  }
}

/** Orquestador: asegura una sola sync a la vez y cola una extra si llega otra señal. */
async function triggerSync(
  reason: 'foreground' | 'online' | 'background' | 'queued' | 'startup' | 'startup-online',
) {
  const now = Date.now()
  console.log(`[bootstrap] triggerSync (${reason})`)

  // NEW: cooldown para evitar syncs demasiado pegadas
  if (!_syncRunning && now - _lastSyncAt < SYNC_COOLDOWN_MS && reason !== 'background') {
    console.log('[bootstrap] cooldown activo; se omite sync')
    return
  }

  if (_syncRunning) {
    _syncQueued = true
    return
  }

  _syncRunning = true
  try {
    await maybeRunSync()
    _lastSyncAt = Date.now()
  } finally {
    _syncRunning = false
    if (_syncQueued) {
      _syncQueued = false
      setTimeout(() => {
        triggerSync('queued').catch(e => console.warn('[bootstrap] queued sync error:', e))
      }, 0)
    }
  }
}

/** Punto único para disparar la sincronización real */
async function maybeRunSync() {
  try {
    // TODO: reemplazar por tu SyncService real
    // import { runSyncOnce } from '@processes/sync/SyncService'
    // await runSyncOnce()
    console.log('[bootstrap] (placeholder) sync run')
  } catch (e) {
    console.warn('[bootstrap] error en sync:', e)
  }
}

/** Limpieza de listeners y background task */
export function teardownBootstrap() {
  try {
    _cleanup?.()
  } catch {}
  _cleanup = null
  _bootPromise = null

  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  _syncRunning = false
  _syncQueued = false

  unregisterBackgroundSync().catch(() => {})
}
