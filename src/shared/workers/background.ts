import * as TaskManager from 'expo-task-manager'
import * as BackgroundTask from 'expo-background-task'

/**
 * Nombre estable y único de la tarea de background.
 */
const TASK_NAME = 'kma.sync.task'

/**
 * Runner inyectado desde bootstrap (SyncService.runOnce).
 * La concurrencia la maneja SyncService internamente.
 */
let runner: null | (() => Promise<void>) = null

/**
 * Definimos la tarea en scope global UNA sola vez.
 */
function defineTaskOnce() {
  const tm: any = TaskManager as any
  if (typeof tm.isTaskDefined === 'function' && tm.isTaskDefined(TASK_NAME)) return

  TaskManager.defineTask(TASK_NAME, async () => {
    if (!runner) {
      // No hay runner inyectado; no hacemos nada.
      return
    }
    try {
      await runner()
    } catch (e) {
      // No fallamos la task: log y salimos. iOS decide cuándo relanzar.
      console.warn('[BackgroundTask] runner failed:', e)
    }
  })
}

// Aseguramos definición al cargar el módulo
defineTaskOnce()

/**
 * Registra la tarea (idempotente) y setea el runner.
 * iOS ejecutará la tarea cuando lo considere
 */
export async function registerBackgroundSync(runOnce: () => Promise<void>) {
  runner = runOnce

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME)
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(TASK_NAME, {
        minimumInterval: 30 * 60, // 30 minutos
      })
      if (__DEV__) console.log('[BackgroundTask] registered')
    } else {
      if (__DEV__) console.log('[BackgroundTask] already registered')
    }
  } catch (e) {
    console.warn('[BackgroundTask] register failed:', e)
  }
}

/** Desregistra la tarea y limpia el runner (idempotente). */
export async function unregisterBackgroundSync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME)
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME)
      if (__DEV__) console.log('[BackgroundTask] unregistered')
    }
  } catch (e) {
    console.warn('[BackgroundTask] unregister failed:', e)
  } finally {
    runner = null
  }
}
