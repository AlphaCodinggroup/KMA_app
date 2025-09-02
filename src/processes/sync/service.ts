import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { AppState } from 'react-native'
import { sqliteOutboxRepo } from '@core/repos/outbox.repo'
import { client } from '@core/http/client'
import { CONFIG } from '@shared/config'

/**
 * Nombre único de la tarea de background para `TaskManager`.
 * @constant {string}
 */
const TASK_NAME = 'KMA_SYNC_TASK'

/**
 * Define la tarea de background que ejecuta un ciclo de sincronización.
 * Debe estar en el scope del módulo (no dentro de funciones) para que el
 * runtime nativo pueda invocarla.
 */
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await runSyncCycle()
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

/**
 * Registra la tarea de BackgroundFetch si está disponible en el dispositivo.
 * Usa un intervalo mínimo de 15 minutos (900 segundos). En iOS este intervalo
 * es solo una sugerencia y el sistema puede espaciar o agrupar ejecuciones.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync()
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, { minimumInterval: 15 * 60 })
    }
  } catch {
    // Ignorado: sin registro no crítico, la app sigue funcionando con triggers de foreground/reconexión
  }
}

/**
 * Ejecuta un ciclo de sincronización:
 * - Obtiene un lote FIFO desde el outbox (tamaño `CONFIG.SYNC_BATCH_SIZE`).
 * - Intenta enviar cada ítem al backend. Si el envío es exitoso, elimina el ítem del outbox.
 * - Si falla, incrementa intentos y guarda el último error.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function runSyncCycle(): Promise<void> {
  const batch = await sqliteOutboxRepo.nextBatch(CONFIG.SYNC_BATCH_SIZE)
  for (const item of batch) {
    try {
      // Enviar según tipo (ejemplo genérico)
      await client.post('/sync', { type: item.type, payload: item.payload })
      // Si tenía archivo, tu backend debería confirmarlo; luego purgar (y borrar archivo si aplica)
      await sqliteOutboxRepo.markSuccess(item.id)
      // TODO: borrar archivo local asociado al item.filePath sólo tras confirmación real del backend
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown'
      await sqliteOutboxRepo.markFailure(item.id, message)
    }
  }
}

/**
 * Registra triggers de sincronización cuando la app vuelve a primer plano.
 * Compara el estado previo con el nuevo (`inactive|background` -> `active`) y
 * lanza `runSyncCycle()`.
 *
 * @returns {void}
 * @remarks
 */
let appState = AppState.currentState
export function registerForegroundTriggers(): void {
  AppState.addEventListener('change', async next => {
    if (appState.match(/inactive|background/) && next === 'active') {
      await runSyncCycle()
    }
    appState = next
  })
}
