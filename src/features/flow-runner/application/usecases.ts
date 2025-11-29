import * as FileSystem from 'expo-file-system'
import { Buffer } from 'buffer'

import type { FlowDetail } from '@shared/validation/steps.schema'
import type { Flow, Step } from '@entities/flow/model'
import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import type { SubmissionRepo } from '@entities/submission/ports'
import type { FlowRepo } from '@entities/flow/ports'
import { putPresignedBinary, request } from '@core/http/http'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { createOfflineFirstFlowRepo } from '@features/selector/data/flow.repo.offline'
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

// API pública
/**
 * Best-effort: asegurar que el flow esté actualizado/local antes de ejecutar.
 *
 * - Si hay red, el FlowRepo offline-first irá a la API y cacheará el detalle.
 * - Si no hay red, intentará resolverlo desde SQLite.
 * - Cualquier error se loguea en dev, pero no rompe el flujo de la pantalla.
 */
export async function ensureFlowSynced(flowId: string): Promise<void> {
  try {
    await flowRepo.getById(flowId)
  } catch (err) {
    if (__DEV__) {
      console.warn('[ensureFlowSynced] Failed to sync flow', flowId, err)
    }
  }
}

/**
 * Carga el flow (incluye steps) utilizando el FlowRepo offline-first
 * y lo mapea a FlowDetail (VM de pantalla).
 *
 * - Online: la implementación del repo consulta la API y cachea en SQLite.
 * - Offline / error de red: intenta reconstruir desde la cache local.
 */
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
 * Flujo online:
 * 1. Detecta fotos locales (file://)
 * 2. POST /uploads -> presigned URLs + audit_id
 * 3. PUT binario a cada upload_url (S3, sin Authorization)
 * 4. POST /audits con { id, flow_id, project_id, facility_id, answers:[...] }
 *
 * Offline:
 * - Guarda el draft en SQLite y lo encola en outbox como "AUDIT_SUBMISSION".
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
  const isOnline = await resolveOnlineStatus(params.online)

  const draft: SubmissionDraft = {
    flowId: params.flowId,
    title: params.title,
    createdAt: Date.now(),
    answers: params.answers,
  }

  // OFFLINE → encolar en outbox y salir (éxito lógico: se guardó para sync)
  if (!isOnline) {
    await queueOfflineSubmission(draft, {
      projectId: params.projectId ?? '',
      facilityId: params.facilityId ?? '',
      version: params.version ?? '',
    })
    return true
  }

  // ONLINE
  try {
    // Fotos locales -> lista para presign
    const photosToUpload = collectLocalPhotos(params.answers)
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
      answers: params.answers,
      uploadMap,
    })

    // POST /audits (crea la auditoría final)
    const body = {
      id: auditId,
      flow_id: params.flowId,
      project_id: params.projectId ?? '',
      facility_id: params.facilityId ?? '',
      answers: answersForApi,
      flow_version: Number(params.version ?? 1),
    }

    const resp = await request<{ status?: number }>({
      method: 'POST',
      url: '/audits',
      data: body,
    })

    const ok = resp.status === 201
    return ok
  } catch (err) {
    console.warn('[finalizeSubmission] error:', err)
    return false
  }
}

// Helpers privados
/**
 * Resuelve el estado online efectivo:
 * - Si se pasa explícitamente `online`, respeta ese valor.
 * - Si no, consulta el helper compartido de red.
 */
async function resolveOnlineStatus(explicitOnline?: boolean): Promise<boolean> {
  if (typeof explicitOnline === 'boolean') return explicitOnline
  return isOnlineOnce()
}

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
 *
 * Normalizamos eso: devolvemos SIEMPRE un array de fotos.
 */
function extractPhotoArray(values: Record<string, unknown>): unknown[] {
  const v = values ?? {}
  if (Array.isArray(v.photos)) return v.photos
  if (Array.isArray(v.photo)) return v.photo
  return []
}

/**
 * Recorre todas las respuestas y junta las fotos locales (file://...) que haya que subir.
 *
 * Genera pares (uploadName, localUri) para alimentar `/uploads`.
 */
function collectLocalPhotos(answers: Record<string, SubmissionAnswer>): PhotoToUpload[] {
  const out: PhotoToUpload[] = []
  const nowTs = Date.now()

  Object.entries(answers).forEach(([stepId, ans]) => {
    if (ans?.type !== 'Form') return

    const vals = ans.values ?? {}
    const photos = extractPhotoArray(vals)

    photos.forEach((p, idx: number) => {
      // p puede ser string ("file:///...jpg") o un objeto { uri, name, type }
      const localUri: string =
        (typeof p === 'string' ? p : (p as any)?.uri || (p as any)?.localUri || '') ?? ''
      if (!localUri || !localUri.startsWith('file')) {
        // si NO es file:// asumimos que ya es remoto (ej "s3://...") -> no subir
        return
      }

      // Inferir nombre base
      const rawName: string | undefined =
        (typeof p === 'string'
          ? undefined
          : (p as any).name || (p as any).fileName || (p as any).filename) ??
        localUri.split('/').pop() ??
        `photo_${idx}.jpg`

      const ext = rawName?.includes('.') ? rawName.split('.').pop() : 'jpg'

      // Nombre final único para esta subida
      const uploadName = `${stepId}_${idx}_${nowTs}.${ext}`

      // Inferir mime
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
 * Lee file://... como base64 y lo convierte a Uint8Array binario
 * para poder hacer PUT a S3 con la URL presignada.
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
 * Normaliza:
 *  - 'Question' con option => 'Select'
 *  - 'Form' con { photo / photos } => { photos: ['s3://...'] }
 */
function buildAnswersForApi(params: {
  answers: Record<string, SubmissionAnswer>
  uploadMap: Record<string, string> // fileName -> s3://...
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

    // PREGUNTAS (YES/NO o SELECT)
    if (ans.type === 'Question') {
      // Caso SELECT:
      // runtime guarda { type:'Question', answer:null, option:'...' }
      if (ans.option && !ans.answer) {
        return {
          step_id: stepId,
          type: 'Select',
          answer: ans.option ?? null,
        }
      }

      // Caso YES / NO / skip
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

      // Copiamos valores para no mutar el original
      const outValues: Record<string, unknown> = { ...values }

      // Fotos → "photos": ['s3://...']
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
 */
async function queueOfflineSubmission(
  draft: SubmissionDraft,
  context: { projectId?: string; facilityId?: string; version?: string },
): Promise<void> {
  try {
    // Persistimos el draft en submissions
    const { id } = await submissionRepo.saveDraft({
      draft,
      projectId: context.projectId ?? '',
      facilityId: context.facilityId ?? '',
      version: context.version ?? '',
    })

    // Detectamos fotos locales para adjuntarlas como filePaths
    const photosToUpload = collectLocalPhotos(draft.answers)
    const filePaths =
      photosToUpload.length > 0
        ? photosToUpload
            .map(p => p.localUri)
            .filter(uri => typeof uri === 'string' && uri.startsWith('file://'))
        : []

    // Encolamos en outbox usando el contrato real del repo:
    // endpoint + method, donde endpoint actúa como “tipo” lógico de la tarea.
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
  } catch (err) {
    if (__DEV__) {
      console.warn('[queueOfflineSubmission] Failed to enqueue submission', err)
    }
  }
}
