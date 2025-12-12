import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

/**
 * Último estado de red conocido.
 * - null = todavía no sabemos (no llegó ningún evento).
 * - true  = online
 * - false = offline
 */
let lastKnownOnline: boolean | null = null

// Guardamos la función de unsubscribe para no registrar múltiples listeners.
let unsubscribeNetInfo: (() => void) | null = null

function computeIsOnline(state: NetInfoState): boolean {
  const isConnected = state.isConnected === true
  const isInternetReachable =
    state.isInternetReachable == null || state.isInternetReachable === true

  return isConnected && isInternetReachable
}

/**
 * Arranca un watcher global de red.
 * Llamar UNA sola vez, por ejemplo en bootstrap.
 */
export function initNetworkWatcher(): void {
  if (unsubscribeNetInfo) return

  unsubscribeNetInfo = NetInfo.addEventListener(state => {
    lastKnownOnline = computeIsOnline(state)
    if (__DEV__) {
      console.log('[network] lastKnownOnline =', lastKnownOnline)
    }
  })
}

/**
 * (Opcional) Detener el watcher global.
 * Podés no usarlo nunca si la app vive siempre mientras el proceso exista.
 */
export function disposeNetworkWatcher(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo()
    unsubscribeNetInfo = null
  }
  lastKnownOnline = null
}

/**
 * Devuelve el último estado de red conocido.
 * - null si todavía no llegó ningún evento de NetInfo.
 */
export function getLastKnownOnline(): boolean | null {
  return lastKnownOnline
}

/**
 * Helper puntual para evaluar el estado de red en este momento.
 * No usa el watcher, hace un NetInfo.fetch() cada vez.
 */
export async function isOnlineOnce(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    return computeIsOnline(state)
  } catch (err) {
    if (__DEV__) {
      console.warn('[network.isOnlineOnce] NetInfo.fetch failed, assuming offline', err)
    }
    return false
  }
}
