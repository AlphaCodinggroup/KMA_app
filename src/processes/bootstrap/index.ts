import { AppState, type AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import * as FileSystem from 'expo-file-system'

import { initDatabase } from '@shared/storage/db'
import { registerBackgroundSync, unregisterBackgroundSync } from '@shared/workers/background'
import { initSession, subscribe } from '@shared/session/session'

import { SyncService, type OutboxRepo, type OutboxItem } from '@processes/sync/SyncService'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import type { SubmissionSnapshot } from '@entities/submission/ports'
import { submitAuditOnlineFromSnapshot } from '@features/flow-runner/application/usecases'
import { syncAllCatalogs } from '@processes/catalog-sync'
import { coldSyncAllFlows } from '@features/selector/application/usecases'
import { registerOutboxSyncTrigger } from '@processes/sync/outboxTrigger'
import { initNetworkWatcher } from '@shared/lib/network'

let _bootPromise: Promise<void> | null = null
let _cleanup: (() => void) | null = null

const AUDIT_SUBMISSION_ENDPOINT = 'AUDIT_SUBMISSION'

type AuditSubmissionOutboxPayload = {
  submissionId: string
}

/**
 * Dispatcher del SyncService.
 */
function createOutboxDispatcher() {
  return async (item: OutboxItem): Promise<'success' | 'retry' | 'drop'> => {
    if (item.type === AUDIT_SUBMISSION_ENDPOINT) return handleAuditSubmissionItem(item)

    if (__DEV__) {
      console.log('[SyncService] dispatch (noop):', {
        id: item.id,
        type: item.type,
      })
    }

    return 'success'
  }
}

/**
 * Maneja un item de outbox de tipo AUDIT_SUBMISSION.
 */
async function handleAuditSubmissionItem(item: OutboxItem): Promise<'success' | 'retry' | 'drop'> {
  const payload = (item.payload ?? null) as Partial<AuditSubmissionOutboxPayload> | null
  const submissionId = payload?.submissionId

  if (!submissionId) {
    if (__DEV__) {
      console.warn('[SyncService] AUDIT_SUBMISSION sin submissionId, drop', item)
    }
    return 'drop'
  }

  const snapshot = await sqliteSubmissionRepo.getById(submissionId)
  if (!snapshot) {
    if (__DEV__) {
      console.warn(
        '[SyncService] Submission no encontrada, drop outbox item',
        submissionId,
        item.id,
      )
    }
    return 'drop'
  }

  try {
    const result = await submitAuditOnlineFromSnapshot(snapshot)

    if (result === 'success') {
      // Envío OK → limpiamos datos y archivos locales
      await cleanupSubmissionFiles(snapshot)
      await sqliteSubmissionRepo.delete(submissionId)

      if (__DEV__) {
        console.log('[SyncService] AUDIT_SUBMISSION synced & cleaned', submissionId)
      }

      return 'success'
    }

    if (result === 'drop') {
      if (__DEV__) {
        console.warn('[SyncService] AUDIT_SUBMISSION drop (4xx)', submissionId)
      }
      return 'drop'
    }

    // retry
    return 'retry'
  } catch (err) {
    if (__DEV__) {
      console.warn('[SyncService] AUDIT_SUBMISSION error, retry', err)
    }
    return 'retry'
  }
}

/**
 * Borra todas las fotos locales (file://...) asociadas a una submission.
 */
async function cleanupSubmissionFiles(snapshot: SubmissionSnapshot): Promise<void> {
  const answers = snapshot.answers ?? {}
  const fileUris = new Set<string>()

  Object.values(answers).forEach(ans => {
    if (!ans || ans.type !== 'Form') return

    const values = ans.values ?? {}
    const photos = extractPhotoArrayFromValues(values)

    photos.forEach(p => {
      const uri: string =
        (typeof p === 'string' ? p : (p as any)?.uri || (p as any)?.localUri || (p as any)?.url) ??
        ''

      if (typeof uri === 'string' && uri.startsWith('file://')) {
        fileUris.add(uri)
      }
    })
  })

  for (const uri of fileUris) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true })
    } catch (err) {
      if (__DEV__) {
        console.warn('[SyncService] Error al borrar archivo local', uri, err)
      }
    }
  }
}

/**
 * Extrae un array de posibles fotos desde values.{photo|photos}.
 */
function extractPhotoArrayFromValues(values: Record<string, unknown>): unknown[] {
  const v = values ?? {}
  if (Array.isArray(v.photos)) return v.photos
  if (Array.isArray(v.photo)) return v.photo
  return []
}

// -----------------------------------------------------------------------------
// Bootstrap general de la app
// -----------------------------------------------------------------------------

export async function bootstrapApp(): Promise<void> {
  initNetworkWatcher()
  if (_bootPromise) return _bootPromise

  _bootPromise = (async () => {
    await initDatabase()
    await initSession()

    const outbox: OutboxRepo = sqliteOutboxRepo
    const sync = new SyncService({
      outbox,
      dispatch: createOutboxDispatcher(),
    })

    const queueOutboxSync = () => sync.queue()
    const forceOutboxSync = () => sync.queue({ resetBackoff: true })

    registerOutboxSyncTrigger(queueOutboxSync)

    const queueCatalogSync = () => {
      syncAllCatalogs().catch(err => {
        if (__DEV__) {
          console.warn('[bootstrap] syncAllCatalogs failed', err)
        }
      })
    }

    let flowsSyncInProgress = false
    const queueFlowsSync = () => {
      if (flowsSyncInProgress) return
      flowsSyncInProgress = true

      coldSyncAllFlows()
        .catch(err => {
          if (__DEV__) {
            console.warn('[bootstrap] coldSyncAllFlows failed', err)
          }
        })
        .finally(() => {
          flowsSyncInProgress = false
        })
    }

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        forceOutboxSync()
        queueCatalogSync()
        queueFlowsSync()
      }
    }
    const appStateSub = AppState.addEventListener('change', handleAppStateChange)

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected === true
      const isInternetReachable =
        state.isInternetReachable == null || state.isInternetReachable === true

      const online = isConnected && isInternetReachable

      if (online) {
        forceOutboxSync()
        queueCatalogSync()
        queueFlowsSync()
      }
    })

    const unsubscribeSession = subscribe(e => {
      if (e.type === 'login') {
        forceOutboxSync()
      }
      if (e.type === 'refresh') {
        forceOutboxSync()
        queueCatalogSync()
        queueFlowsSync()
      }
      if (e.type === 'logout') {
        // Si más adelante hay workers ligados a sesión, se limpian acá.
      }
    })

    await registerBackgroundSync(() => sync.runOnce())

    _cleanup = () => {
      appStateSub.remove()
      unsubscribeNetInfo()
      unsubscribeSession()
      unregisterBackgroundSync().catch(() => void 0)
    }

    // Disparo inicial al boot: solo outbox.
    queueOutboxSync()
  })()

  return _bootPromise
}

export function cleanupBootstrap() {
  _cleanup?.()
  _bootPromise = null
}
