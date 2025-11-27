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
import { finalizeSubmission } from '@features/flow-runner/application/usecases'
import { syncAllCatalogs } from '@processes/catalog-sync'
import { coldSyncAllFlows } from '@features/selector/application/usecases'

let _bootPromise: Promise<void> | null = null
let _cleanup: (() => void) | null = null

const AUDIT_SUBMISSION_ENDPOINT = 'AUDIT_SUBMISSION'

type AuditSubmissionOutboxPayload = {
  submissionId: string
}

/**
 * Dispatcher del SyncService.
 *
 * - AUDIT_SUBMISSION: toma la submission local, ejecuta el mismo flujo online
 *   que `finalizeSubmission` y, si sale bien, borra datos/fotos locales.
 * - Otros tipos: por ahora NO-OP (success inmediato).
 */
function createOutboxDispatcher() {
  return async (item: OutboxItem): Promise<'success' | 'retry' | 'drop'> => {
    if (item.type === AUDIT_SUBMISSION_ENDPOINT) return handleAuditSubmissionItem(item)

    if (__DEV__) {
      console.log('[SyncService] dispatch (noop):', item)
    }
    // Cualquier otro tipo que aún no manejemos explícitamente se considera éxito
    return 'success'
  }
}

/**
 * Maneja un item de outbox de tipo AUDIT_SUBMISSION:
 *
 *  Lee submissionId del payload.
 *  Recupera la submission desde SQLite.
 *  Llama a finalizeSubmission(...) forzando `online: true`.
 *  Si salió bien:
 *    - borra fotos locales (file://)
 *    - borra la submission local
 *
 * Devuelve:
 * - 'success' → SyncService hará markSuccess(id) y eliminará el item de outbox.
 * - 'retry'   → SyncService aplicará backoff y reintento.
 * - 'drop'    → SyncService eliminará el item sin reintento.
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
    const ok = await finalizeSubmission({
      flowId: snapshot.flowId,
      title: snapshot.title,
      answers: snapshot.answers,
      projectId: snapshot.projectId ?? '',
      facilityId: snapshot.facilityId ?? '',
      version: snapshot.version ?? '',
      // Forzamos online=true para que NO vuelva a encolar en outbox
      online: true,
    })

    if (!ok) {
      // Puede ser error de red, 5xx, auth, etc.
      // Dejamos que SyncService reintente con backoff.
      return 'retry'
    }

    // Envío OK → limpiamos datos y archivos locales
    await cleanupSubmissionFiles(snapshot)
    await sqliteSubmissionRepo.delete(submissionId)

    if (__DEV__) {
      console.log('[SyncService] AUDIT_SUBMISSION synced & cleaned', submissionId)
    }

    return 'success'
  } catch (err) {
    if (__DEV__) {
      console.warn('[SyncService] AUDIT_SUBMISSION error, retry', err)
    }
    return 'retry'
  }
}

/**
 * Borra todas las fotos locales (file://...) asociadas a una submission.
 * Se basa en las respuestas guardadas en `snapshot.answers`.
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
  if (_bootPromise) return _bootPromise

  _bootPromise = (async () => {
    // DB y sesión primero
    await initDatabase()
    await initSession()

    // SyncService con outbox real (SQLite) + dispatcher con AUDIT_SUBMISSION
    const outbox: OutboxRepo = sqliteOutboxRepo
    const sync = new SyncService({
      outbox,
      dispatch: createOutboxDispatcher(),
      // batchSize / retryBaseDelayMs / retryMaxAttempts vienen por env o defaults
    })

    /**
     * Helper centralizado para disparar:
     *  - sync de outbox (auditorías pendientes)
     *
     * Los catálogos se disparan aparte, de forma controlada,
     * para evitar GET redundantes (projects/facilities/flows).
     */
    const queueOutboxSync = () => {
      sync.queue()
    }

    /**
     * Helper para sync de catálogos (projects + facilities).
     * Best-effort: no queremos romper la UI si falla.
     */
    const queueCatalogSync = () => {
      syncAllCatalogs().catch(err => {
        if (__DEV__) {
          console.warn('[bootstrap] syncAllCatalogs failed', err)
        }
      })
    }

    /**
     * Helper para cold sync de flows (incluye steps e imágenes,
     * según la implementación de coldSyncAllFlows).
     *
     * Usa un pequeño guard para evitar múltiples llamadas concurrentes
     * cuando se disparan AppState + NetInfo al mismo tiempo.
     */
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

    // AppState: cuando la app vuelve a foreground, disparamos outbox + catálogos + flows
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        queueOutboxSync()
        queueCatalogSync()
        queueFlowsSync()
      }
    }
    const appStateSub = AppState.addEventListener('change', handleAppStateChange)

    // NetInfo: cuando vuelve la conexión, disparamos outbox + catálogos + flows
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        queueOutboxSync()
        queueCatalogSync()
        queueFlowsSync()
      }
    })

    // Eventos de sesión:
    // - login: solo outbox (los catálogos/flows se cargan perezosamente
    //   desde las pantallas y por los triggers de AppState/NetInfo).
    // - refresh: outbox + catálogos + flows (tokens renovados → refrescamos data).
    const unsubscribeSession = subscribe(e => {
      if (e.type === 'login') {
        queueOutboxSync()
      }
      if (e.type === 'refresh') {
        queueOutboxSync()
        queueCatalogSync()
        queueFlowsSync()
      }
      if (e.type === 'logout') {
        // Si más adelante hay workers ligados a sesión, se limpian acá.
      }
    })

    // Background task (best effort iOS) → por ahora sólo outbox.
    // Si en algún momento quisieras incluir catálogos/flows acá, podés llamar
    // a syncAllCatalogs() y coldSyncAllFlows() dentro del callback, con la
    // misma filosofía best-effort.
    await registerBackgroundSync(() => sync.runOnce())

    // Cleanup centralizado
    _cleanup = () => {
      appStateSub.remove()
      unsubscribeNetInfo()
      unsubscribeSession()
      unregisterBackgroundSync().catch(() => void 0)
    }

    // Disparo inicial al boot:
    //  - solo outbox. Los catálogos y flows se cargan:
    //    - perezosamente desde las features (useProjects, useFlows, etc.),
    //    - o por los triggers de AppState/NetInfo/refresh.
    queueOutboxSync()
  })()

  return _bootPromise
}

export function cleanupBootstrap() {
  _cleanup?.()
  _bootPromise = null
}
