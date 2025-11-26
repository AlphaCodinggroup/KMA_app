import NetInfo from '@react-native-community/netinfo'

/**
 * Helper centralizado para leer el estado de red una sola vez.
 *
 * - Devuelve `true` si hay conectividad reportada por NetInfo.
 * - En caso de error o valores inesperados, asume OFFLINE (false).
 */
export async function isOnlineOnce(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()

    // isConnected puede venir como null/undefined → lo normalizamos a booleano
    return !!state.isConnected
  } catch (err) {
    if (__DEV__) {
      console.warn('[network.isOnlineOnce] NetInfo.fetch failed, assuming offline', err)
    }
    return false
  }
}
