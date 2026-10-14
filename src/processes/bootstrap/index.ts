import { AppState, type AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import * as FileSystem from 'expo-file-system'

import { initDatabase } from '@shared/storage/db'
import { registerBackgroundSync, unregisterBackgroundSync } from '@shared/workers/background'
import { getCurrentUserId, getSnapshot, initSession, subscribe } from '@shared/session/session'

import { SyncService, type OutboxRepo, type OutboxItem } from '@processes/sync/SyncService'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import type { SubmissionSnapshot } from '@entities/submission/ports'
import { extractPhotoArray, photoUriOf } from '@entities/submission/lib/photos'
import { submitAuditOnlineFromSnapshot } from '@features/flow-runner/application/usecases'
import { syncAllCatalogs } from '@processes/catalog-sync'
import { coldSyncAllFlows } from '@features/selector/application/usecases'
import { registerOutboxSyncTrigger } from '@processes/sync/outboxTrigger'
import { notifyFailedAuditsChanged } from '@processes/sync/failedAuditsSignal'
import { PHOTOS_ROOT, discardPhotoGroup } from '@features/camera'
import { migrateCachedPhotos } from './migratePhotos'
import { initNetworkWatcher, isOnlineOnce } from '@shared/lib/network'

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
  return async (item: OutboxItem): Promise<'success' | 'retry' | 'fail' | 'drop' | 'defer'> => {
    if (item.type === AUDIT_SUBMISSION_ENDPOINT) return handleAuditSubmissionItem(item)

    // Tipo que esta versión no sabe procesar (p. ej. creado por un build más nuevo): se posterga
    // sin sumar intentos ni borrarlo, para que lo procese la versión que lo entienda.
    if (__DEV__) {
      console.log('[SyncService] tipo de outbox desconocido, defer:', {
        id: item.id,
        type: item.type,
      })
    }

    return 'defer'
  }
}

/**
 * Maneja un item de outbox de tipo AUDIT_SUBMISSION.
 */
async function handleAuditSubmissionItem(
  item: OutboxItem,
): Promise<'success' | 'retry' | 'fail' | 'drop'> {
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

    if (result === 'fail') {
      if (__DEV__) {
        console.warn('[SyncService] AUDIT_SUBMISSION fail (4xx)', submissionId)
      }
      return 'fail'
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
 * Un item del outbox pasó a `failed`: la submission asociada debe quedar `failed`
 * (con motivo) para listarse en la UI. El resultado `fail` ya la marcó con el error del backend;
 * al agotar intentos hay que marcarla acá.
 */
async function handleOutboxItemFailed(item: OutboxItem, reason: string): Promise<void> {
  if (item.type !== AUDIT_SUBMISSION_ENDPOINT) return

  const payload = (item.payload ?? null) as Partial<AuditSubmissionOutboxPayload> | null
  const submissionId = payload?.submissionId
  if (!submissionId) return

  const snapshot = await sqliteSubmissionRepo.getById(submissionId)
  if (!snapshot) return

  if (snapshot.status !== 'failed') {
    await sqliteSubmissionRepo.markStatus(
      submissionId,
      'failed',
      JSON.stringify({
        status: null,
        error: 'max_attempts',
        message: 'The audit could not be sent after several attempts.',
        detail: reason,
      }),
    )
  }

  notifyFailedAuditsChanged()
}

/**
 * Backfill de dueño: las filas sin `user_id` (creadas con la 1.0.8) se asignan al usuario de la
 * sesión actual. Asume un solo auditor por dispositivo (a confirmar con el cliente).
 */
async function claimOrphanRows(): Promise<void> {
  const userId = getCurrentUserId()
  if (!userId) return
  try {
    await sqliteSubmissionRepo.assignOwner(userId)
    await sqliteOutboxRepo.assignOwner(userId)
  } catch (err) {
    if (__DEV__) {
      console.warn('[bootstrap] claimOrphanRows failed', err)
    }
  }
}

/**
 * Borra todas las fotos locales (file://...) asociadas a una submission y su directorio.
 */
async function cleanupSubmissionFiles(snapshot: SubmissionSnapshot): Promise<void> {
  const fileUris = new Set<string>()

  Object.values(snapshot.answers ?? {}).forEach(ans => {
    if (!ans || ans.type !== 'Form') return
    for (const p of extractPhotoArray(ans.values)) {
      const uri = photoUriOf(p)
      if (uri.startsWith('file://')) fileUris.add(uri)
    }
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

  // El directorio de la submission se borra completo (incluye fotos descartadas que hayan quedado)
  await discardPhotoGroup(snapshot.id)

  // Fotos de la 1.0.8 en directorios ajenos: se borran si quedaron vacíos
  const dirs = new Set([...fileUris].map(u => u.slice(0, u.lastIndexOf('/'))))
  for (const dir of dirs) {
    if (!PHOTOS_ROOT || !dir.startsWith(`${PHOTOS_ROOT}/`)) continue
    try {
      const left = await FileSystem.readDirectoryAsync(dir)
      if (left.length === 0) await FileSystem.deleteAsync(dir, { idempotent: true })
    } catch {
      // el directorio ya no existe
    }
  }
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
    await claimOrphanRows()
    await migrateCachedPhotos()

    const outbox: OutboxRepo = sqliteOutboxRepo
    const sync = new SyncService({
      outbox,
      dispatch: createOutboxDispatcher(),
      getUserId: getCurrentUserId,
      isOnline: isOnlineOnce,
      onFailed: handleOutboxItemFailed,
    })

    const hasAuthenticatedSession = () => Boolean(getSnapshot().refreshToken)

    const queueOutboxSync = () => {
      if (!hasAuthenticatedSession()) return
      sync.queue()
    }

    const forceOutboxSync = () => {
      if (!hasAuthenticatedSession()) return
      sync.queue({ resetBackoff: true })
    }

    registerOutboxSyncTrigger(queueOutboxSync)

    const queueCatalogSync = () => {
      if (!hasAuthenticatedSession()) return
      syncAllCatalogs().catch(err => {
        if (__DEV__) {
          console.warn('[bootstrap] syncAllCatalogs failed', err)
        }
      })
    }

    let flowsSyncInProgress = false
    const queueFlowsSync = () => {
      if (!hasAuthenticatedSession()) return
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
        // Foreground: respeta el backoff persistido. El reset queda para red recuperada,
        // login, refresh de sesión y el Retry manual; si no, cada apertura de la app consumiría intentos.
        queueOutboxSync()
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
        claimOrphanRows().finally(forceOutboxSync)
        queueCatalogSync()
        queueFlowsSync()
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

    // Disparo inicial al boot sólo si ya existe sesión persistida.
    queueOutboxSync()
    queueCatalogSync()
    queueFlowsSync()
  })()

  return _bootPromise
}

export function cleanupBootstrap() {
  _cleanup?.()
  _bootPromise = null
}
