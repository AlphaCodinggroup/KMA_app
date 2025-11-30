import * as FileSystem from 'expo-file-system'
import { Buffer } from 'buffer'

import type { FlowDetail } from '@shared/validation/steps.schema'
import type { Flow, Step } from '@entities/flow/model'
import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import type { SubmissionRepo, SubmissionSnapshot } from '@entities/submission/ports'
import type { FlowRepo } from '@entities/flow/ports'
import { putPresignedBinary, request } from '@core/http/http'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { createOfflineFirstFlowRepo } from '@features/selector/data/flow.repo.offline'
import { showAuditCreatedToast, showAuditProcessingToast } from '@shared/ui/toast/AppToast'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { isOnlineOnce } from '@shared/lib/network'

// Repos / singletons
const flowRepo: FlowRepo = createOfflineFirstFlowRepo()
const submissionRepo: SubmissionRepo = sqliteSubmissionRepo

// Tipos y constantes internas
type PhotoToUpload = {
  stepId: string
  localUri: string
  uploadName: string
  mimeType: string
}

type AuditAnswerForApi =
  | {
      step_id: string
      type: 'Question' | 'Select'
      answer: string | null
    }
  | {
      step_id: string
      type: 'Form'
      values: Record<string, unknown>
    }

type PresignRequestFile = {
  name: string
  step_id: string
}

type PresignResponse = {
  audit_id: string
  urls: Array<{
    file_name: string
    upload_url: string
    file_url: string
  }>
}

type AuditSubmissionOutboxPayload = {
  submissionId: string
}

/**
 * Campos que el backend considera numéricos opcionales:
 * - Si los mandamos, tienen que ser number
 * - Si están vacíos o no son parseables -> no mandarlos
 */
const NUMERIC_OPTIONAL_FIELDS = new Set<string>(['quantity', 'measurements'])

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------
export async function ensureFlowSynced(flowId: string): Promise<void> {
  try {
    await flowRepo.getById(flowId)
  } catch (err) {
    if (__DEV__) {
      console.warn('[ensureFlowSynced] Failed to sync flow', flowId, err)
    }
  }
}

export async function loadFlowDetail(flowId: string): Promise<FlowDetail> {
  const flow = await flowRepo.getById(flowId)
  if (!flow) {
    throw new Error(`Flow ${flowId} no encontrado`)
  }
  return mapToFlowDetail(flow)
}

/**
 * Persistencia de borrador local en SQLite (draft de auditoría).
 */
export async function persistDraft(params: {
  flowId: string
  title: string
  answers: Record<string, SubmissionAnswer>
  projectId?: string
  facilityId?: string
  version?: string
}): Promise<void> {
  const draft: SubmissionDraft = {
    flowId: params.flowId,
    title: params.title,
    createdAt: Date.now(),
    answers: params.answers,
  }

  try {
    await submissionRepo.saveDraft({
      draft,
      projectId: params.projectId ?? '',
      facilityId: params.facilityId ?? '',
      version: params.version ?? '',
    })
  } catch (err) {
    if (__DEV__) {
      console.warn('[persistDraft] Failed to save draft', err)
    }
  }
}

/**
 * finalizeSubmission
 *
 * Nuevo comportamiento:
 * - Siempre guarda la auditoría en SQLite como submission "final".
 * - Siempre la encola en outbox con type "AUDIT_SUBMISSION".
 * - Muestra un toast de "Processing" con el título.
 * - Devuelve `true` si pudo guardar + encolar (independientemente de la conexión).
 *
 * El envío real (uploads + /audits) se hace SOLO desde el SyncService
 * vía `submitAuditOnlineFromSnapshot`.
 */
export async function finalizeSubmission(params: {
  flowId: string
  title: string
  answers: Record<string, SubmissionAnswer>
  online?: boolean
  projectId?: string
  facilityId?: string
  version?: string
}): Promise<boolean> {
  const draft: SubmissionDraft = {
    flowId: params.flowId,
    title: params.title,
    createdAt: Date.now(),
    answers: params.answers,
  }

  // Guardar en SQLite + encolar en outbox + toast "Processing"
  await queueOfflineSubmission(draft, {
    projectId: params.projectId ?? '',
    facilityId: params.facilityId ?? '',
    version: params.version ?? '',
  })

  // Si sabemos que está online, disparamos sync inmediato.
  //    Si está offline, dejamos que NetInfo/AppState/background lo disparen cuando corresponda.
  if (params.online === true) {
    triggerOutboxSync()
  }

  return true
}

/**
 * Usecase específico para el SyncService:
 *
 * - Recibe un SubmissionSnapshot desde SQLite.
 * - Ejecuta TODO el flujo online:
 *   1) Detecta fotos locales (file://)
 *   2) POST /uploads -> presigned URLs + audit_id
 *   3) PUT binario a cada upload_url
 *   4) POST /audits con { id, flow_id, project_id, facility_id, answers:[...] }
 * - Si sale bien:
 *   - Muestra toast de éxito con el título.
 *   - Devuelve `true`.
 * - Si falla:
 *   - Devuelve `false` (para que el SyncService reintente).
 */
export async function submitAuditOnlineFromSnapshot(
  snapshot: SubmissionSnapshot,
): Promise<boolean> {
  // Antes de hacer cualquier request, chequeamos conectividad real
  const online = await isOnlineOnce()
  if (!online) {
    if (__DEV__) {
      console.log('[submitAuditOnlineFromSnapshot] skipped: offline')
    }
    // Devolvemos false para que el SyncService lo marque como "retry"
    // y vuelva a intentarlo más adelante cuando haya conexión.
    return false
  }

  try {
    const answers = snapshot.answers as Record<string, SubmissionAnswer>

    // Fotos locales -> lista para presign
    const photosToUpload = collectLocalPhotos(answers)
    const presignFiles: PresignRequestFile[] = photosToUpload.map(p => ({
      name: p.uploadName,
      step_id: p.stepId,
    }))

    // Pedir presigned URLs
    const presignRes = await request<PresignResponse>({
      method: 'POST',
      url: '/uploads',
      data: { files: presignFiles },
    })

    const auditId = presignRes.audit_id
    const uploadEntries = presignRes.urls

    const byFileName: Record<string, { upload_url: string; file_url: string }> = {}
    for (const u of uploadEntries) {
      byFileName[u.file_name] = {
        upload_url: u.upload_url,
        file_url: u.file_url,
      }
    }

    // Subir cada foto a S3 via PUT presignado
    for (const p of photosToUpload) {
      const match = byFileName[p.uploadName]
      if (!match) continue

      const fileBytes = await readFileAsUint8(p.localUri)
      await putPresignedBinary({
        url: match.upload_url,
        data: fileBytes,
        contentType: p.mimeType,
      })
    }

    // Construir mapa nombreArchivo -> ruta s3://...
    const uploadMap: Record<string, string> = {}
    for (const u of uploadEntries) {
      uploadMap[u.file_name] = u.file_url
    }

    // Armar answers normalizados para /audits
    const answersForApi: AuditAnswerForApi[] = buildAnswersForApi({
      answers,
      uploadMap,
    })

    // POST /audits (crea la auditoría final)
    await request<void>({
      method: 'POST',
      url: '/audits',
      data: {
        id: auditId,
        flow_id: snapshot.flowId,
        project_id: snapshot.projectId ?? '',
        facility_id: snapshot.facilityId ?? '',
        answers: answersForApi,
        flow_version: Number(snapshot.version ?? 1),
      },
    })

    // Éxito → toast de auditoría creada
    showAuditCreatedToast(snapshot.title)

    return true
  } catch (err) {
    console.warn('[submitAuditOnlineFromSnapshot] error:', err)
    return false
  }
}

// -----------------------------------------------------------------------------
// Helpers privados
// -----------------------------------------------------------------------------

// Mappers dominio -> VM de pantalla
function mapToFlowDetail(flow: Flow): FlowDetail {
  return {
    flowId: flow.flowId,
    title: flow.title,
    steps: flow.steps.map(mapStepToDetail),
  }
}

function mapStepToDetail(step: Step): FlowDetail['steps'][number] {
  switch (step.type) {
    case 'Question': {
      return {
        id: step.id,
        type: 'Question',
        text: step.text,
        yesNext: step.yesNext,
        noNext: step.noNext,
      }
    }
    case 'Form': {
      return {
        id: step.id,
        type: 'Form',
        title: step.title,
        next: step.next,
        fields: step.fields.map(f => ({
          id: f.id,
          type: f.type,
          label: f.label,
        })),
      }
    }
    case 'Select': {
      return {
        id: step.id,
        type: 'Select',
        title: step.title,
        text: step.text,
        options: step.options.map(o => ({ label: o.label, next: o.next })),
      }
    }
    case 'End': {
      return {
        id: step.id,
        type: 'End',
      }
    }
    default: {
      const _exhaustive: never = step as never
      throw new Error(`mapStepToDetail: Tipo de Step no soportado: ${_exhaustive}`)
    }
  }
}

/**
 * Algunos formularios guardan las fotos en `values.photo`
 * Otros podrían guardarlas en `values.photos`.
 */
function extractPhotoArray(values: Record<string, unknown>): unknown[] {
  const v = values ?? {}
  if (Array.isArray(v.photos)) return v.photos
  if (Array.isArray(v.photo)) return v.photo
  return []
}

/**
 * Recorre todas las respuestas y junta las fotos locales (file://...) que haya que subir.
 */
function collectLocalPhotos(answers: Record<string, SubmissionAnswer>): PhotoToUpload[] {
  const out: PhotoToUpload[] = []
  const nowTs = Date.now()

  Object.entries(answers).forEach(([stepId, ans]) => {
    if (ans?.type !== 'Form') return

    const vals = ans.values ?? {}
    const photos = extractPhotoArray(vals)

    photos.forEach((p, idx: number) => {
      const localUri: string =
        (typeof p === 'string' ? p : (p as any)?.uri || (p as any)?.localUri || '') ?? ''
      if (!localUri || !localUri.startsWith('file')) return

      const rawName: string | undefined =
        (typeof p === 'string'
          ? undefined
          : (p as any).name || (p as any).fileName || (p as any).filename) ??
        localUri.split('/').pop() ??
        `photo_${idx}.jpg`

      const ext = rawName?.includes('.') ? rawName.split('.').pop() : 'jpg'

      const uploadName = `${stepId}_${idx}_${nowTs}.${ext}`

      const mimeType: string =
        (typeof p === 'string' ? undefined : (p as any).type) || guessMimeFromExt(ext || 'jpg')

      out.push({
        stepId,
        localUri,
        uploadName,
        mimeType,
      })
    })
  })

  return out
}

/**
 * Inferencia MIME básica.
 */
function guessMimeFromExt(ext: string): string {
  const lower = ext.toLowerCase()
  if (lower === 'jpg' || lower === 'jpeg') return 'image/jpeg'
  if (lower === 'png') return 'image/png'
  if (lower === 'heic' || lower === 'heif') return 'image/heic'
  return 'application/octet-stream'
}

/**
 * Lee file://... como base64 y lo convierte a Uint8Array binario.
 */
async function readFileAsUint8(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const buf = Buffer.from(base64, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

/**
 * Convierte tus respuestas internas en lo que /audits espera.
 */
function buildAnswersForApi(params: {
  answers: Record<string, SubmissionAnswer>
  uploadMap: Record<string, string>
}): AuditAnswerForApi[] {
  const { answers, uploadMap } = params

  return Object.entries(answers).map(([stepId, ans]) => {
    if (!ans) {
      return {
        step_id: stepId,
        type: 'Question',
        answer: null,
      }
    }

    if (ans.type === 'Question') {
      if (ans.option && !ans.answer) {
        return {
          step_id: stepId,
          type: 'Select',
          answer: ans.option ?? null,
        }
      }

      const normalized = ans.answer != null ? String(ans.answer).toLowerCase() : null

      return {
        step_id: stepId,
        type: 'Question',
        answer: normalized,
      }
    }

    // FORMULARIOS
    if (ans.type === 'Form') {
      const values = ans.values ?? {}
      // Fotos → "photos": ['s3://...']
      const outValues: Record<string, unknown> = { ...values }

      const rawArray = extractPhotoArray(outValues)

      const mappedUrls = rawArray
        .map((p, idx: number) => {
          // Caso ya remoto
          if (typeof p === 'string' && p.startsWith('s3://')) return p
          // Caso local: buscamos key en uploadMap que matchee `${stepId}_${idx}_...`
          const prefix = `${stepId}_${idx}_`
          const matchKey = Object.keys(uploadMap).find(k => k.startsWith(prefix))
          return matchKey ? uploadMap[matchKey] : null
        })
        .filter((u): u is string => !!u)

      if (mappedUrls.length > 0) {
        outValues.photos = mappedUrls
      }

      // Quitamos el campo crudo "photo" si existía
      delete outValues.photo

      // Campos numéricos opcionales
      for (const key of NUMERIC_OPTIONAL_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(outValues, key)) continue

        const value = outValues[key]

        if (value === null || typeof value === 'undefined') {
          delete outValues[key]
          continue
        }

        if (typeof value === 'number') continue

        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed === '') {
            delete outValues[key]
            continue
          }
          const numVal = Number(trimmed)
          if (Number.isNaN(numVal)) {
            delete outValues[key]
            continue
          }
          outValues[key] = numVal
          continue
        }

        // Cualquier otro tipo lo descartamos
        delete outValues[key]
      }

      return {
        step_id: stepId,
        type: 'Form',
        values: outValues,
      }
    }

    // fallback defensivo
    return {
      step_id: stepId,
      type: 'Question',
      answer: null,
    }
  })
}

/**
 * Cola offline real:
 *  - Guarda el draft en `submissions`.
 *  - Encola item en `outbox` con type "AUDIT_SUBMISSION".
 *  - Adjunta filePaths con los file:// de las fotos para futura limpieza.
 *  - Muestra toast de "Processing".
 */
async function queueOfflineSubmission(
  draft: SubmissionDraft,
  context: { projectId?: string; facilityId?: string; version?: string },
): Promise<void> {
  // Persistimos el draft en submissions
  const { id } = await submissionRepo.saveDraft({
    draft,
    projectId: context.projectId ?? '',
    facilityId: context.facilityId ?? '',
    version: context.version ?? '',
  })

  // Avisamos que se está procesando (modo offline / encolado)
  showAuditProcessingToast(draft.title)

  // Detectamos fotos locales para adjuntarlas como filePaths
  const photosToUpload = collectLocalPhotos(draft.answers)
  const filePaths =
    photosToUpload.length > 0
      ? photosToUpload
          .map(p => p.localUri)
          .filter(uri => typeof uri === 'string' && uri.startsWith('file://'))
      : []

  // Encolamos en outbox usando el contrato real del repo
  const payload: AuditSubmissionOutboxPayload = { submissionId: id }

  await sqliteOutboxRepo.enqueue({
    endpoint: 'AUDIT_SUBMISSION',
    method: 'USECASE',
    payload,
    filePaths,
  })

  if (__DEV__) {
    console.log('[OUTBOX] Enqueued AUDIT_SUBMISSION', { submissionId: id })
  }
}
