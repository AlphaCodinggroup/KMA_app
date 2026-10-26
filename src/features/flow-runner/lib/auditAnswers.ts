import type { AuditAnswer } from '@entities/audit/model'
import type { SubmissionAnswer } from '@entities/submission/model'
import { extractPhotoArray, photoUriOf } from '@entities/submission/lib/photos'
import { normalizeQuestionAnswerValue } from '@shared/lib/questionAnswers'
import type { FormStep, Step } from '@shared/validation/steps.schema'

/**
 * Valores de un Form del backend → valores del formulario. En el backend las fotos viajan en
 * `values.photos`; el form las maneja bajo el id de su campo `photo`. Números → texto (inputs).
 */
function formValuesFromAudit(step: FormStep, values: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...values }

  const photoField = step.fields.find(f => f.type === 'photo')
  if (photoField) {
    const photos = extractPhotoArray(values).map(photoUriOf).filter(Boolean)
    delete out.photos
    delete out.photo
    out[photoField.id] = photos
  }

  for (const f of step.fields) {
    if ((f.type === 'number' || f.type === 'text') && typeof out[f.id] === 'number') {
      out[f.id] = String(out[f.id])
    }
  }

  return out
}

/**
 * Respuestas del backend (`answers[]`) → respuestas internas del runner. Los pasos que ya no existen
 * en el flow se descartan; el tipo de cada paso lo manda el flow, no el `type` guardado.
 */
export function auditAnswersToLocal(
  steps: Step[],
  answers: AuditAnswer[],
): Record<string, SubmissionAnswer> {
  const byId = new Map(steps.map(s => [s.id, s]))
  const out: Record<string, SubmissionAnswer> = {}

  for (const a of answers) {
    const step = byId.get(a.stepId)
    if (!step) continue

    if (step.type === 'Select') {
      if (typeof a.answer === 'string' && a.answer) {
        out[a.stepId] = { type: 'Question', answer: null, option: a.answer }
      }
    } else if (step.type === 'Question') {
      const value = normalizeQuestionAnswerValue(a.answer)
      if (value) out[a.stepId] = { type: 'Question', answer: value }
    } else if (step.type === 'Form') {
      out[a.stepId] = { type: 'Form', values: formValuesFromAudit(step, a.values ?? {}) }
    }
  }

  return out
}
