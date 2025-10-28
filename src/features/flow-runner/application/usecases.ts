import NetInfo from '@react-native-community/netinfo'
import * as FileSystem from 'expo-file-system'
import { Buffer } from 'buffer'
import type { FlowDetail } from '@shared/validation/steps.schema'
import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import type { Flow, Step } from '@entities/flow/model'
import { putPresignedBinary, request } from '@core/http/http'
import { createHttpFlowRepo } from '@features/selector/data/flow.repo.http'

// -----------------------------------------------------------------------------
// Repositorio HTTP de Flows
// -----------------------------------------------------------------------------
const flowRepo = createHttpFlowRepo()

/** Best-effort: asegurar que el flow esté actualizado/local antes de ejecutar. */
export async function ensureFlowSynced(flowId: string): Promise<void> {
  // En una versión con cache/SQLite: verificar staleness y refrescar.
  void flowId
  return Promise.resolve()
}

// -----------------------------------------------------------------------------
// Mappers dominio -> VM de pantalla
// -----------------------------------------------------------------------------
function mapToFlowDetail(flow: Flow): FlowDetail {
  return {
    flowId: flow.flowId,
    title: flow.title,
    description: flow.description || '',
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

// -----------------------------------------------------------------------------
// Carga remota del flow
// -----------------------------------------------------------------------------
export async function loadFlowDetail(flowId: string): Promise<FlowDetail> {
  const flow = await flowRepo.getById(flowId)
  if (!flow) {
    throw new Error(`Flow ${flowId} no encontrado`)
  }
  return mapToFlowDetail(flow)
}

// -----------------------------------------------------------------------------
// Persistencia de borrador local (por ahora console.log / TODO: SQLite)
// -----------------------------------------------------------------------------
export async function persistDraft(params: {
  flowId: string
  title: string
  answers: Record<string, SubmissionAnswer>
}): Promise<void> {
  const payload = {
    flowId: params.flowId,
    title: params.title,
    createdAt: new Date().toISOString(),
    answers: params.answers,
  }
  console.log('[FLOW SUBMISSION DRAFT]', JSON.stringify(payload, null, 2))
}

// -----------------------------------------------------------------------------
// Helpers para fotos y payload final
// -----------------------------------------------------------------------------

/**
 * Algunos formularios guardan las fotos en `values.photo`
 * Otros podrían guardarlas en `values.photos`
 *
 * Normalizamos eso: devolvemos SIEMPRE un array de fotos (puede ser string file:// o s3://
 * o un objeto { uri, name?, type? }).
 */
function extractPhotoArray(values: Record<string, unknown>): any[] {
  const v = values ?? {}
  if (Array.isArray(v.photos)) return v.photos
  if (Array.isArray(v.photo)) return v.photo
  return []
}

/**
 * Recorre las respuestas y junta las fotos locales (file://...) que haya que subir.
 *
 * Genera para cada foto un nombre único estable que vamos a pedirle al backend
 * en /uploads:
 *   `${stepId}_${idx}_${timestamp}.${ext}`
 */
function collectLocalPhotos(answers: Record<string, SubmissionAnswer>): Array<{
  stepId: string
  localUri: string
  uploadName: string
  mimeType: string
}> {
  const out: Array<{
    stepId: string
    localUri: string
    uploadName: string
    mimeType: string
  }> = []

  const nowTs = Date.now()

  Object.entries(answers).forEach(([stepId, ans]) => {
    if (ans?.type !== 'Form') return

    const vals = ans.values ?? {}
    const photos = extractPhotoArray(vals)

    photos.forEach((p, idx: number) => {
      // p puede ser string ("file:///...jpg") o un objeto { uri, name, type }
      const localUri: string = (typeof p === 'string' ? p : p?.uri || p?.localUri || '') ?? ''
      if (!localUri || !localUri.startsWith('file')) {
        // si NO es file:// asumimos que ya es remoto (ej "s3://...") -> no subir
        return
      }

      // Inferir nombre base
      const rawName: string | undefined =
        (typeof p === 'string' ? undefined : p.name || p.fileName || p.filename) ??
        localUri.split('/').pop() ??
        `photo_${idx}.jpg`

      const ext = rawName?.includes('.') ? rawName?.split('.').pop() : 'jpg'

      // Nombre final único para esta subida
      const uploadName = `${stepId}_${idx}_${nowTs}.${ext}`

      // Inferir mime
      const mimeType: string =
        (typeof p === 'string' ? undefined : p.type) || guessMimeFromExt(ext || 'jpg')

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
 * Inferencia MIME básica
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
  // PRIMER INTENTO: usar expo-file-system si está disponible y sano
  if (FileSystem && typeof FileSystem.readAsStringAsync === 'function') {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Convertimos base64 -> bytes
    const binaryString = globalThis.atob
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary')

    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  // SEGUNDO INTENTO (fallback): usar fetch(file://...) y arrayBuffer()
  // React Native soporta fetch sobre URIs locales tipo file:///... en iOS/Android.
  const resp = await fetch(uri)
  const buf = await resp.arrayBuffer()
  return new Uint8Array(buf)
}

// -----------------------------------------------------------------------------
// Mapeo answers internos -> formato final de /audits
// -----------------------------------------------------------------------------

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

/**
 * buildAnswersForApi
 *
 * - Convierte tus respuestas internas en lo que /audits espera.
 * - Normaliza:
 *    * 'Question' con option => 'Select'
 *    * 'Form' con { photo / photos } => { photos: ['s3://...'] }
 */
function buildAnswersForApi(params: {
  answers: Record<string, SubmissionAnswer>
  uploadMap: Record<string, string> // fileName -> s3://...
}): AuditAnswerForApi[] {
  const { answers, uploadMap } = params

  // Campos que el backend considera numéricos opcionales:
  // - Si los mandamos, tienen que ser number (no string)
  // - Si están vacíos o no son parseables -> no mandarlos
  const NUMERIC_OPTIONAL_FIELDS = new Set(['quantity', 'measurements'])

  return Object.entries(answers).map(([stepId, ans]) => {
    if (!ans) {
      return {
        step_id: stepId,
        type: 'Question',
        answer: null,
      }
    }

    // --------------------------
    // PREGUNTAS (YES/NO o SELECT)
    // --------------------------
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
      const normalized =
        ans.answer != null
          ? String(ans.answer).toLowerCase() // "YES" -> "yes"
          : null

      return {
        step_id: stepId,
        type: 'Question',
        answer: normalized,
      }
    }

    // --------------------------
    // FORMS
    // --------------------------
    if (ans.type === 'Form') {
      // Copiamos los valores del form para mutarlos sin tocar answersRef
      const outValues: Record<string, unknown> = { ...ans.values }

      // 1. Fotos
      //    - Tu formulario guarda las fotos bajo "photo" (array de file://)
      //      y a veces podría venir "photos".
      //    - Nosotros las convertimos a "photos": ["s3://..."] finales
      //      usando uploadMap.
      const rawArray = extractPhotoArray(outValues)

      const mappedUrls = rawArray
        .map((p, idx: number) => {
          // Caso ya remoto
          if (typeof p === 'string' && p.startsWith('s3://')) return p

          // Caso local file://... -> buscamos la key de uploadMap que
          // matchea el patrón `${stepId}_${idx}_<timestamp>.<ext>`
          const prefix = `${stepId}_${idx}_`
          const matchKey = Object.keys(uploadMap).find(k => k.startsWith(prefix))
          return matchKey ? uploadMap[matchKey] : null
        })
        .filter(Boolean)

      if (mappedUrls.length > 0) {
        outValues.photos = mappedUrls
      }

      // Quitamos la key "photo" cruda, porque tenía file:// locales
      delete outValues.photo

      // 2. Limpieza genérica de valores escalares:
      //    - ""  -> null
      //    - "12" / "3.5" -> número
      //    - "texto libre" -> queda igual
      for (const [k, v] of Object.entries(outValues)) {
        if (k === 'photos') continue // no tocar fotos

        if (typeof v === 'string') {
          const trimmed = v.trim()

          // string vacío -> null
          if (trimmed === '') {
            outValues[k] = null
            continue
          }

          // ¿es un número válido tipo "12" o "3.5"?
          if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const numVal = Number(trimmed)
            if (!Number.isNaN(numVal)) {
              outValues[k] = numVal
            }
          }
          // si no matchea número, queda tal cual string
        }
      }

      // 3. Reglas estrictas de campos numéricos opcionales:
      //    quantity / measurements:
      //    - si existen y NO son number => las borramos
      //    - si existen y son null => las borramos
      for (const numericKey of NUMERIC_OPTIONAL_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(outValues, numericKey)) {
          const val = outValues[numericKey]

          if (val === null || typeof val === 'undefined') {
            delete outValues[numericKey]
            continue
          }

          if (typeof val === 'number') {
            // OK, lo dejamos así
            continue
          }

          if (typeof val === 'string') {
            // Intento final de parseo
            const trimmed = val.trim()
            if (trimmed === '') {
              delete outValues[numericKey]
              continue
            }
            const numVal = Number(trimmed)
            if (!Number.isNaN(numVal)) {
              outValues[numericKey] = numVal
            } else {
              delete outValues[numericKey]
            }
            continue
          }

          // cualquier otra cosa que no sea number -> no se manda
          delete outValues[numericKey]
        }
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

// -----------------------------------------------------------------------------
// Offline queue stub
// -----------------------------------------------------------------------------
async function queueOfflineSubmission(draft: SubmissionDraft) {
  // En real:
  // - Guardar en SQLite (tabla outbox) con estado "pending".
  // - El sync en background va a tomar esto, pedir presigned URLs y subir.
  console.log('[OUTBOX] Enqueued submission (offline):', JSON.stringify(draft, null, 2))
}

// -----------------------------------------------------------------------------
// Tipos para presign
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// FINAL: finalizar auditoría
// -----------------------------------------------------------------------------
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
 * - Encola draft en outbox para sync posterior.
 */
export async function finalizeSubmission(params: {
  flowId: string
  title: string
  answers: Record<string, SubmissionAnswer>
  online?: boolean
  projectId?: string
  facilityId?: string
}): Promise<void> {
  // 0. conectividad real
  const isOnline =
    typeof params.online === 'boolean' ? params.online : !!(await NetInfo.fetch()).isConnected

  // Draft común
  const draft: SubmissionDraft = {
    flowId: params.flowId,
    title: params.title,
    createdAt: Date.now(),
    answers: params.answers,
  }

  if (!isOnline) {
    await queueOfflineSubmission(draft)
    return
  }

  // 1. fotos locales -> lista upload
  const photosToUpload = collectLocalPhotos(params.answers)
  // armamos body para /uploads
  const presignFiles: PresignRequestFile[] = photosToUpload.map(p => ({
    name: p.uploadName,
    step_id: p.stepId,
  }))

  // 2. pedir presigned URLs
  const presignRes = await request<PresignResponse>({
    method: 'POST',
    url: '/uploads',
    data: { files: presignFiles },
  })

  const auditId = presignRes.audit_id
  const uploadEntries = presignRes.urls // [{file_name, upload_url, file_url}, ...]

  const byFileName: Record<string, { upload_url: string; file_url: string }> = {}
  for (const u of uploadEntries) {
    byFileName[u.file_name] = {
      upload_url: u.upload_url,
      file_url: u.file_url,
    }
  }

  // 3. subir cada foto a S3 via PUT presignado
  for (const p of photosToUpload) {
    const match = byFileName[p.uploadName]
    if (!match) {
      console.warn('[finalizeSubmission] Missing presigned URL for', p.uploadName)
      continue
    }

    const fileBytes = await readFileAsUint8(p.localUri)

    await putPresignedBinary({
      url: match.upload_url,
      data: fileBytes,
      contentType: p.mimeType,
    })
  }

  // 4. construir mapa nombreArchivo -> ruta s3://...
  const uploadMap: Record<string, string> = {}
  for (const u of uploadEntries) {
    uploadMap[u.file_name] = u.file_url
  }

  // 5. armar answers normalizados para /audits
  const answersForApi: AuditAnswerForApi[] = buildAnswersForApi({
    answers: params.answers,
    uploadMap,
  })

  // 6. POST /audits (crea la auditoría final)
  const body = {
    id: auditId,
    flow_id: params.flowId,
    project_id: params.projectId ?? 'UNIMPLEMENTED_PROJECT_ID',
    facility_id: params.facilityId ?? 'UNIMPLEMENTED_FACILITY_ID',
    answers: answersForApi,
  }

  await request({
    method: 'POST',
    url: '/audits',
    data: body,
  })

  // TODO futuro:
  // - limpiar draft local
  // - marcar en outbox como enviado si era retry
  console.log('[finalizeSubmission] audit sent OK:', auditId)
}
