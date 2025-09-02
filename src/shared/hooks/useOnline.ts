import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

/**
 * Indica si hay conexión usable a Internet.
 * Combina `isConnected` con `isInternetReachable` (cuando está disponible).
 *
 * @returns {boolean} `true` si hay conectividad efectiva, `false` en caso contrario.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(true)

  useEffect(() => {
    const sub = NetInfo.addEventListener(s =>
      setOnline(Boolean(s.isConnected && s.isInternetReachable !== false)),
    )
    return () => sub()
  }, [])

  return online
}
