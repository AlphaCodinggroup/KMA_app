import { useEffect, useState } from 'react'
import { LOW_DISK_BYTES, getFreeDiskBytes } from '@shared/lib/diskSpace'

/** `true` si el dispositivo tiene poco espacio libre. Se consulta una vez al montar. */
export function useLowStorage(): boolean {
  const [low, setLow] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getFreeDiskBytes().then(free => {
      if (!cancelled && free !== null) setLow(free < LOW_DISK_BYTES)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return low
}
