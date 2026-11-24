/**
 * Helpers puros del estado de sync por paso de una auditoría V2 (columnas `answer_sync_json` y
 * `deleted_step_ids_json`). Sin red ni SQLite: reciben y devuelven datos nuevos, no mutan.
 */

export type AnswerSyncStatus = 'pending' | 'synced'
export type AnswerSyncMap = Record<string, AnswerSyncStatus>

/* ------------------------------ (de)serialización ------------------------------ */

/** Lee `answer_sync_json`; tolera null, JSON roto o valores desconocidos (se descartan). */
export function parseAnswerSync(json: string | null | undefined): AnswerSyncMap {
  if (!json) return {}
  try {
    const raw: unknown = JSON.parse(json)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: AnswerSyncMap = {}
    for (const [stepId, status] of Object.entries(raw)) {
      if (status === 'pending' || status === 'synced') out[stepId] = status
    }
    return out
  } catch {
    return {}
  }
}

/** Lee `deleted_step_ids_json`; tolera null y JSON roto. Sin duplicados. */
export function parseDeletedStepIds(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const raw: unknown = JSON.parse(json)
    if (!Array.isArray(raw)) return []
    return Array.from(new Set(raw.filter((x): x is string => typeof x === 'string')))
  } catch {
    return []
  }
}

/* ------------------------------------ helpers ----------------------------------- */

/** Marca los pasos como pendientes de enviar (alta o re-edición de una respuesta). */
export function markAnswersPending(map: AnswerSyncMap, stepIds: readonly string[]): AnswerSyncMap {
  const next: AnswerSyncMap = { ...map }
  for (const id of stepIds) next[id] = 'pending'
  return next
}

/**
 * Marca como enviados los pasos confirmados por el backend. Solo toca los ids indicados y que sigan
 * en el mapa: un paso podado mientras viajaba el PATCH no se resucita.
 */
export function markAnswersSynced(map: AnswerSyncMap, stepIds: readonly string[]): AnswerSyncMap {
  const next: AnswerSyncMap = { ...map }
  for (const id of stepIds) {
    if (id in next) next[id] = 'synced'
  }
  return next
}

/** Ids de los pasos pendientes, en el orden en que se marcaron. */
export function getPendingAnswers(map: AnswerSyncMap): string[] {
  return Object.keys(map).filter(id => map[id] === 'pending')
}

/**
 * Poda de rama: quita `removedStepIds` del mapa de sync y calcula qué hay que borrar en el server.
 * - Los que estaban `synced` el backend ya los tiene → se suman a `deletedStepIds` (BE-3).
 * - Los que nunca se enviaron (`pending` o desconocidos) solo se borran localmente.
 * - Un id ya presente en `deletedStepIds` no se duplica.
 */
export function diffDeletedStepIds(input: {
  syncMap: AnswerSyncMap
  removedStepIds: readonly string[]
  deletedStepIds?: readonly string[]
}): { syncMap: AnswerSyncMap; deletedStepIds: string[] } {
  const syncMap: AnswerSyncMap = { ...input.syncMap }
  const deleted = new Set(input.deletedStepIds ?? [])

  for (const id of input.removedStepIds) {
    if (syncMap[id] === 'synced') deleted.add(id)
    delete syncMap[id]
  }

  return { syncMap, deletedStepIds: Array.from(deleted) }
}
