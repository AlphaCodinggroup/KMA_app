import type { FlowSummary, Flow } from '@entities/flow/model'
import type { FlowRepo } from '@entities/flow/ports'
import { createOfflineFirstFlowRepo } from '../data/flow.repo.offline'

/**
 * Singleton muy simple para no instanciar el repo en cada llamada.
 */
let flowRepoInstance: FlowRepo | null = null

const getFlowRepo = (): FlowRepo => {
  if (!flowRepoInstance) {
    flowRepoInstance = createOfflineFirstFlowRepo()
  }
  return flowRepoInstance
}

/**
 * Carga todos los flows completos (incluye steps).
 * Ahora delega en el FlowRepo offline-first:
 *  - Online: va a la API y sincroniza SQLite (catálogo + steps).
 *  - Offline / error de red: intenta reconstruir desde la cache local.
 */
export async function loadAllFlowsWithSteps(): Promise<Flow[]> {
  const repo = getFlowRepo()
  return repo.getAll()
}

/**
 * Carga el catálogo resumido para las tarjetas del Selector.
 * Usa directamente getSummaries() del repo offline-first, que:
 *  - Online: pide a la API, cachea en SQLite y aplica filtros/paginación.
 *  - Offline: lee solo desde la base local.
 */
export async function loadCatalog(): Promise<FlowSummary[]> {
  const repo = getFlowRepo()
  return repo.getSummaries()
}

/**
 * Sincronización en frío (hook para procesos cross-feature).
 *
 * De momento, la propia carga de flows vía loadAllFlowsWithSteps() ya dispara
 * la sincronización en SQLite gracias al repositorio offline-first.
 *
 * Este placeholder queda como punto de entrada para:
 *  - bootstrap (al arrancar la app),
 *  - workers en background/foreground,
 * sin duplicar lógica de red aquí.
 */
export async function coldSyncAllFlows(): Promise<void> {
  return
}
