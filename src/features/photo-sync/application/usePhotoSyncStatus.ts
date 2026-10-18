import { useCallback, useEffect, useMemo, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { retryPhotoSync } from '@processes/sync/retryPhotoSync'
import { usePhotoRows } from './photoSyncStore'
import { badgeOf, countPhotos } from './photoSyncState'
import type { PhotoBadgeStatus } from '@shared/ui/photo/PhotoSyncBadge'

function useIsOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false)
    })
    return unsubscribe
  }, [])
  return online
}

/**
 * Estado de sincronización de fotos V2. Con `submissionId` filtra a esa auditoría; sin él cubre todas
 * las del usuario (indicador global de Profile). Se actualiza solo cuando cambia `photo_uploads`.
 */
export function usePhotoSyncStatus(submissionId?: string) {
  const allRows = usePhotoRows()
  const online = useIsOnline()
  const [retrying, setRetrying] = useState(false)

  const photos = useMemo(
    () => (submissionId ? allRows.filter(p => p.submissionId === submissionId) : allRows),
    [allRows, submissionId],
  )

  const counts = useMemo(() => countPhotos(photos), [photos])

  /** Badge por URI local, para los campos de foto del form. */
  const badgeByUri = useMemo(() => {
    const map: Record<string, PhotoBadgeStatus> = {}
    for (const p of photos) map[p.localUri] = badgeOf(p, online)
    return map
  }, [photos, online])

  const retry = useCallback(async () => {
    setRetrying(true)
    try {
      await retryPhotoSync(submissionId)
    } catch (err) {
      if (__DEV__) console.warn('[usePhotoSyncStatus] retry failed', err)
    } finally {
      setRetrying(false)
    }
  }, [submissionId])

  return { photos, counts, badgeByUri, online, retrying, retry }
}
