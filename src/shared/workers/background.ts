import * as TaskManager from 'expo-task-manager'
import * as BackgroundTask from 'expo-background-task'

const TASK_NAME = 'kma.sync.task'

// Runner inyectado desde bootstrap
let runner: null | (() => Promise<void>) = null

// defineTask en scope global
TaskManager.defineTask(TASK_NAME, async () => {
  if (!runner) return
  try {
    await runner()
  } catch (e) {
    console.warn('[BackgroundTask] runner failed:', e)
  }
})

/** Registra la tarea y setea el runner. */
export async function registerBackgroundSync(runOnce: () => Promise<void>) {
  runner = runOnce

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME)
  if (!isRegistered) {
    // El SO puede ejecutarla cuando lo considere; este es el intervalo mínimo sugerido
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 30 * 60, // 30 min (ejemplo real del changelog SDK53)
    })
    console.log('[BackgroundTask] registered')
  } else {
    console.log('[BackgroundTask] already registered')
  }
}

/** Desregistra la tarea y limpia el runner. */
export async function unregisterBackgroundSync() {
  runner = null
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME)
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(TASK_NAME)
    console.log('[BackgroundTask] unregistered')
  }
}
