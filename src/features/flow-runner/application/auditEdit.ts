import { z } from 'zod'
import type { AuditAnswer, CompletedAudit } from '@entities/audit/model'
import { isAuditEditable } from '@entities/audit/lib/status'
import type { SubmissionAnswer } from '@entities/submission/model'
import { getCompletedAudit, saveAuditEdit } from '@features/audits'
import { sqliteFlowRepo } from '@core/repos/sqliteFlowRepo'
import { StepSchema, type Step } from '@shared/validation/steps.schema'

import { auditAnswersToLocal } from '../lib/auditAnswers'
import { replayPath } from '../lib/runnerNavigation'
import { buildAnswersForApi } from './usecases'

export type EditLoadFailure = 'not_found' | 'locked' | 'no_answers' | 'flow_unavailable'

export type EditLoadResult =
  | {
      ok: true
      audit: CompletedAudit
      steps: Step[]
      /** Respuestas en formato interno del runner, ya limpias de huérfanas. */
      answers: Record<string, SubmissionAnswer>
      path: string[]
    }
  | { ok: false; reason: EditLoadFailure; message: string }

const MESSAGES: Record<EditLoadFailure, string> = {
  not_found: 'This audit could not be found.',
  locked: 'This audit is already under review and can no longer be edited.',
  no_answers:
    'The answers of this audit are not available on this device yet. Connect to the internet and try again.',
  flow_unavailable:
    'This audit was completed with a different version of the flow, which is not available on this device. It cannot be edited.',
}

const fail = (reason: EditLoadFailure): EditLoadResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
})

/** "v2", "2", "2.0" → 2. */
const versionNumber = (v: string | undefined): number => Number(String(v ?? '').replace(/^v/i, ''))

/**
 * Steps de la versión del flow con la que se hizo la auditoría:
 * 1) snapshot guardado con la auditoría; 2) flow cacheado si es de la misma versión; si no, null.
 */
async function resolveFlowSteps(audit: CompletedAudit): Promise<Step[] | null> {
  if (audit.flowSnapshot) {
    const parsed = z.array(StepSchema).min(1).safeParse(audit.flowSnapshot)
    if (parsed.success) return parsed.data
  }

  const detail = await sqliteFlowRepo.getFlowDetail(audit.flowId)
  if (!detail) return null
  if (audit.flowVersion !== undefined && versionNumber(detail.version) !== audit.flowVersion) {
    return null
  }
  return detail.steps as Step[]
}

/**
 * Carga todo lo que el runner necesita para editar una auditoría completada: detalle con
 * respuestas (online → backend, offline → cache), steps de su versión y el camino reconstruido.
 */
export async function loadAuditForEdit(auditId: string): Promise<EditLoadResult> {
  const audit = await getCompletedAudit(auditId)
  if (!audit) return fail('not_found')
  if (!isAuditEditable(audit.status)) return fail('locked')
  if (!audit.answers) return fail('no_answers')

  const steps = await resolveFlowSteps(audit)
  if (!steps) return fail('flow_unavailable')

  const answers = auditAnswersToLocal(steps, audit.answers)
  const path = replayPath(steps, answers)
  // Respuestas fuera del camino (flow cambiado, datos viejos): no se editan ni se reenvían
  for (const id of Object.keys(answers)) {
    if (!path.includes(id)) delete answers[id]
  }

  return { ok: true, audit, steps, answers, path }
}

/** Respuestas internas → respuestas del dominio audit (conserva `file://` de fotos sin subir). */
export function toAuditAnswers(answers: Record<string, SubmissionAnswer>): AuditAnswer[] {
  return buildAnswersForApi({ answers, uploadMap: {}, keepLocalPhotos: true }).map(a =>
    a.type === 'Form'
      ? { stepId: a.step_id, type: a.type, values: a.values }
      : { stepId: a.step_id, type: a.type, answer: a.answer },
  )
}

/**
 * Guarda la edición en el teléfono y la encola. Devuelve `false` si no hay nada que enviar.
 * - `changedStepIds`: pasos distintos de los de apertura (más los de una edición previa sin enviar);
 *   sólo esos viajan en el PATCH, para no pisar lo que otro dispositivo cambió en otros pasos.
 * - `deletedStepIds`: pasos que tenía la auditoría y ya no tienen respuesta (rama abandonada).
 */
export async function saveEditedAudit(params: {
  auditId: string
  /** Respuestas al abrir la edición (para detectar qué cambió). */
  baseAnswers: Record<string, SubmissionAnswer>
  /** Pasos ya marcados como eliminados / cambiados por una edición anterior sin enviar. */
  priorDeletedStepIds: string[]
  priorChangedStepIds: string[]
  answers: Record<string, SubmissionAnswer>
}): Promise<boolean> {
  const answers = toAuditAnswers(params.answers)
  const base = new Map(toAuditAnswers(params.baseAnswers).map(a => [a.stepId, JSON.stringify(a)]))

  const changedNow = answers
    .filter(a => base.get(a.stepId) !== JSON.stringify(a))
    .map(a => a.stepId)

  // Los pasos que volvieron a tener respuesta ya no están eliminados; los eliminados no se envían como cambios
  const deletedStepIds = [
    ...new Set([
      ...params.priorDeletedStepIds,
      ...Object.keys(params.baseAnswers).filter(id => !(id in params.answers)),
    ]),
  ].filter(id => !(id in params.answers))
  const changedStepIds = [...new Set([...params.priorChangedStepIds, ...changedNow])].filter(
    id => id in params.answers,
  )

  if (changedStepIds.length === 0 && deletedStepIds.length === 0) return false

  await saveAuditEdit(params.auditId, { answers, deletedStepIds, changedStepIds })
  return true
}
