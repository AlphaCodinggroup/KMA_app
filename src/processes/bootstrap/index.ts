import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { initDatabase } from '@shared/storage/db'
import { readJsonSecure } from '@shared/storage/secure'
import { registerBackgroundSync, unregisterBackgroundSync } from '@shared/workers/background'
import { setSessionTokens } from '@shared/session/session'

/** Evita dobles arranques */
let _bootPromise: Promise<void> | null = null
let _cleanup: (() => void) | null = null

/** Sync: control de concurrencia y debounce */
let _syncRunning = false
let _syncQueued = false
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

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
    _cleanup = registerLifecycleTriggers({
      onForeground: () => triggerSync('foreground'),
      onOnline: () => triggerSync('online'),
    })
    await safeRegisterBackground()
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
    // isConnected puede ser true sin salida a internet
    if (state.isConnected && state.isInternetReachable !== false) {
      // Debounce para agrupar ráfagas de eventos
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
async function triggerSync(reason: 'foreground' | 'online' | 'background' | 'queued') {
  console.log(`[bootstrap] triggerSync (${reason})`)

  if (_syncRunning) {
    _syncQueued = true
    return
  }

  _syncRunning = true
  try {
    await maybeRunSync()
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

  unregisterBackgroundSync().catch(() => {})
}
