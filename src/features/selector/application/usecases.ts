import { apiGetAllFlows, apiGetFlow, apiGetFlows } from '@shared/api/flows.api'
import { sqliteFlowRepo } from '@core/repos/sqliteFlowRepo'

/** Carga catálogo: primero local; si hay red, actualiza desde backend. */
export async function loadCatalog() {
  const local = await sqliteFlowRepo.getCatalog()
  try {
    const remote = await apiGetFlows()
    await sqliteFlowRepo.saveCatalog(remote)
    return remote
  } catch {
    return local
  }
}

/** Descarga y persiste un flow completo para uso offline. */
export async function downloadFlow(flowId: string) {
  const detail = await apiGetFlow(flowId)
  await sqliteFlowRepo.saveFlowDetail(detail)
  return detail
}

/** Sincronización en frío: trae todos los flows + steps y persiste todo. */
export async function coldSyncAllFlows() {
  const { flows: details } = await apiGetAllFlows()

  // Construimos un catálogo mínimo a partir de los detalles
  await sqliteFlowRepo.saveCatalog({
    flows: details.map(d => ({
      id: d.flowId,
      title: d.title ?? d.flowId,
      version: d.version,
      stepsCount: d.steps?.length ?? 0,
    })),
  })

  // Guardamos cada detalle (steps)
  for (const d of details) {
    await sqliteFlowRepo.saveFlowDetail(d)
  }

  return { count: details.length }
}
