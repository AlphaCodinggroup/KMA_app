import type { FlowDetail } from '@shared/validation/steps.schema'
import type { Flow, Step, StepCondition, ConditionalNext } from '@entities/flow/model'
import type { SubmissionAnswer, SubmissionDraft } from '@entities/submission/model'
import type { SubmissionRepo, SubmissionSnapshot } from '@entities/submission/ports'
import type { FlowRepo } from '@entities/flow/ports'
import {
  extractPhotoArray,
  photoFieldKey,
  photoUriOf,
  type PhotoValueObject,
} from '@entities/submission/lib/photos'
import { request } from '@core/http/http'
import { expoFileUploader } from '@core/http/fileUploader'
import { sqliteSubmissionRepo } from '@core/repos/sqliteSubmissionRepo'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { createOfflineFirstFlowRepo } from '@features/selector/data/flow.repo.offline'
import { showAuditCreatedToast, showAuditProcessingToast } from '@shared/ui/toast/AppToast'
import { triggerOutboxSync } from '@processes/sync/outboxTrigger'
import { discardPhotoGroup } from '@features/camera'
import { isOnlineOnce } from '@shared/lib/network'
import { getCurrentUserId } from '@shared/session/session'
import { Env } from '@shared/config/env'
import { notifyFailedAuditsChanged } from '@processes/sync/failedAuditsSignal'
import { newAuditId } from './auditId'
import { AUDIT_CREATE_ENDPOINT, auditCreateItemId } from '../lib/auditOutbox'

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

export type AuditAnswerForApi =
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

type SubmitResult = 'success' | 'retry' | 'fail'

type AuditCreateOutboxPayload = {
  submissionId: string
}

/** Respuesta del create / detalle de auditoría: sólo lo que mobile necesita. */
export type RemoteAuditResponse = {
  version?: unknown
  status?: unknown
}

/**
 * Campos que el backend considera numéricos opcionales:
 * - Si los mandamos, tienen que ser number
 * - Si están vacíos o no son parseables -> no mandarlos
 */
/** Fotos que se suben en paralelo por auditoría. */
const PHOTO_UPLOAD_CONCURRENCY = 3

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

/** Id local de una submission (una por corrida del runner). */
export function newSubmissionId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Draft pendiente del usuario actual para ese flow + facility (el más reciente), si existe.
 */
export async function findResumableDraft(params: {
  flowId: string
  projectId?: string
  facilityId?: string
}): Promise<SubmissionSnapshot | null> {
  const userId = getCurrentUserId() ?? undefined
  return submissionRepo.findDraft({
    flowId: params.flowId,
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.facilityId ? { facilityId: params.facilityId } : {}),
    ...(userId ? { userId } : {}),
  })
}

/** Descarta un draft: fila de SQLite + directorio de fotos. */
export async function discardDraft(submissionId: string): Promise<void> {
  try {
    await submissionRepo.delete(submissionId)
  } catch (err) {
    if (__DEV__) console.warn('[discardDraft] No se pudo borrar el draft', submissionId, err)
  }
  await discardPhotoGroup(submissionId)
}

/**
 * V2: crea el borrador local con `audit_id` y encola el `AUDIT_CREATE`.
 *
 * - Sin el flag `AUDITS_V2` no hace nada y devuelve `false` (la corrida sigue por el pipeline v1).
 * - Nunca bloquea al auditor: sin red el create queda en la cola y sale al reconectar.
 * - Si no se puede dejar la fila + el item consistentes, revierte y devuelve `false`: la corrida
 *   sigue por v1 (el primer `persistDraft` inserta una fila v1 normal).
 */
export async function startAuditDraft(params: {
  submissionId: string
  flowId: string
  title: string
  projectId?: string | undefined
  facilityId?: string | undefined
  version?: string | undefined
}): Promise<boolean> {
  if (!Env.flags.auditsV2) return false

  try {
    await submissionRepo.saveDraft({
      id: params.submissionId,
      draft: { flowId: params.flowId, title: params.title, createdAt: Date.now(), answers: {} },
      projectId: params.projectId ?? '',
      facilityId: params.facilityId ?? '',
      version: params.version ?? '',
      auditId: newAuditId(),
      ...ownerFields(),
    })
  } catch (err) {
    if (__DEV__) console.warn('[startAuditDraft] No se pudo crear el borrador', err)
    return false
  }

  try {
    const payload: AuditCreateOutboxPayload = { submissionId: params.submissionId }
    await sqliteOutboxRepo.enqueue({
      id: auditCreateItemId(params.submissionId),
      endpoint: AUDIT_CREATE_ENDPOINT,
      method: 'USECASE',
      payload,
      ...ownerFields(),
    })
  } catch (err) {
    if (__DEV__) console.warn('[startAuditDraft] No se pudo encolar AUDIT_CREATE', err)
    await submissionRepo.delete(params.submissionId).catch(() => undefined)
    return false
  }

  triggerOutboxSync()
  return true
}

/**
 * Usecase del SyncService para `AUDIT_CREATE`: `POST /audits` con el borrador vacío (BE-1, BE-2).
 *
 * - `409` = ya existe (respuesta perdida / reintento) → éxito; la versión se lee con `GET`.
 * - 5xx / red / 401 / 403 / 429 / 408 → 'retry'.
 * - Otro 4xx → 'fail': el item queda `failed` y la submission pasa a `failed` con el mensaje del
 *   backend (`failSubmission`), así se lista en la UI de fallidas con su Retry. El Retry de una V2
 *   que todavía no se finalizó la devuelve a `draft`.
 */
export async function createRemoteAuditDraft(snapshot: SubmissionSnapshot): Promise<SubmitResult> {
  const auditId = snapshot.auditId
  if (snapshot.pipeline !== 'v2' || !auditId) return 'fail'

  // Ya creado en una corrida anterior (se perdió el ack del item)
  if (typeof snapshot.serverVersion === 'number') return 'success'

  if (!(await isOnlineOnce())) return 'retry'

  try {
    let version: number | null = null
    let status: string | undefined

    try {
      const res = await request<RemoteAuditResponse | undefined>({
        method: 'POST',
        url: '/audits',
        data: {
          id: auditId,
          flow_id: snapshot.flowId,
          flow_version: Number(snapshot.version) || 1,
          project_id: snapshot.projectId ?? '',
          facility_id: snapshot.facilityId ?? '',
          answers: [],
        },
      })
      version = readVersion(res)
      status = readStatus(res)
    } catch (err) {
      if (extractStatus(err) !== 409) throw err
      // Si el 409 trae la versión se usa; si no, GET.
      version = readServerVersion(err)
    }

    if (version === null) {
      const remote = await request<RemoteAuditResponse | undefined>({
        method: 'GET',
        url: `/audits/${encodeURIComponent(auditId)}`,
      })
      version = readVersion(remote)
      status = readStatus(remote)
    }

    // Sin versión confiable no hay delta posible: se reintenta (POST → 409 → GET)
    if (version === null) return 'retry'

    await submissionRepo.markServerState(snapshot.id, {
      serverVersion: version,
      ...(status ? { serverStatus: status } : {}),
    })
    return 'success'
  } catch (err) {
    const httpStatus = extractStatus(err)
    if (isRecoverableStatus(httpStatus)) {
      if (__DEV__) console.warn('[createRemoteAuditDraft] retryable error', httpStatus, err)
      return 'retry'
    }
    if (__DEV__) console.warn('[createRemoteAuditDraft] fail (4xx)', httpStatus, err)
    await failSubmission(snapshot.id, err)
    return 'fail'
  }
}

/**
 * Un rechazo no recuperable del backend (V2) deja la submission `failed` con el mensaje, para que
 * se liste en la UI de fallidas con su botón Retry. Nunca lanza.
 */
export async function failSubmission(submissionId: string, err: unknown): Promise<void> {
  try {
    await submissionRepo.markStatus(submissionId, 'failed', buildLastError(err, extractStatus(err)))
    notifyFailedAuditsChanged()
  } catch (markErr) {
    if (__DEV__) console.warn('[failSubmission] No se pudo marcar fallida', markErr)
  }
}

/**
 * Persistencia de borrador local en SQLite (draft de auditoría).
 * Una corrida = una fila: se actualiza siempre `submissionId`.
 */
export async function persistDraft(params: {
  submissionId: string
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
      id: params.submissionId,
      draft,
      projectId: params.projectId ?? '',
      facilityId: params.facilityId ?? '',
      version: params.version ?? '',
      ...ownerFields(),
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
  submissionId: string
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
    submissionId: params.submissionId,
    projectId: params.projectId ?? '',
    facilityId: params.facilityId ?? '',
    version: params.version ?? '',
  })

  // Siempre disparamos sync: si está offline, el SyncService reintentará con backoff.
  triggerOutboxSync()

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
 *   - Devuelve 'success'.
 * - Si falla:
 *   - Devuelve:
 *     - 'retry' en offline/red/5xx.
 *     - 'fail' en 4xx no recuperables: la submission queda `failed` con su `last_error`.
 */
export async function submitAuditOnlineFromSnapshot(
  snapshot: SubmissionSnapshot,
): Promise<SubmitResult> {
  // Antes de hacer cualquier request, chequeamos conectividad real
  const online = await isOnlineOnce()
  if (!online) {
    if (__DEV__) {
      console.log('[submitAuditOnlineFromSnapshot] skipped: offline')
    }
    // Devolvemos retry para que el SyncService vuelva a intentarlo más adelante cuando haya conexión.
    return 'retry'
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

    // Todas las fotos tienen que tener URL antes de subir nada: nunca se envía incompleta
    const targets = photosToUpload.map(p => {
      const match = byFileName[p.uploadName]
      if (!match?.upload_url || !match.file_url) {
        if (__DEV__) {
          console.warn('[submitAuditOnlineFromSnapshot] presign sin URL para', p.uploadName)
        }
        return null
      }
      return { photo: p, uploadUrl: match.upload_url }
    })
    if (targets.some(t => t === null)) return 'retry'

    // Subida a S3 (PUT presignado) con concurrencia acotada: el streaming nativo no carga memoria JS
    await runWithConcurrency(
      targets.filter((t): t is NonNullable<typeof t> => t !== null),
      PHOTO_UPLOAD_CONCURRENCY,
      ({ photo, uploadUrl }) =>
        expoFileUploader.upload({
          url: uploadUrl,
          localUri: photo.localUri,
          contentType: photo.mimeType,
        }),
    )

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

    return 'success'
  } catch (err) {
    const status = extractStatus(err)
    const recoverable = isRecoverableStatus(status)

    if (!recoverable) {
      if (__DEV__) {
        console.warn('[submitAuditOnlineFromSnapshot] fail (4xx)', status, err)
      }
      await submissionRepo.markStatus(snapshot.id, 'failed', buildLastError(err, status))
      return 'fail'
    }

    console.warn('[submitAuditOnlineFromSnapshot] retryable error:', err)
    return 'retry'
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
    version: String(flow.version),
    steps: flow.steps.map(mapStepToDetail),
  }
}

function mapStepConditionToDetail(condition: StepCondition) {
  if (condition.type === 'Question') {
    return {
      type: 'Question' as const,
      stepId: condition.stepId,
      answer: condition.answer,
    }
  }

  return {
    type: 'Select' as const,
    stepId: condition.stepId,
    selectedOption: condition.selectedOption,
  }
}

function mapConditionalNextToDetail(conditional: ConditionalNext) {
  return {
    conditions: conditional.conditions.map(mapStepConditionToDetail),
    next: conditional.next,
    ...(typeof conditional.matchAny === 'boolean' ? { matchAny: conditional.matchAny } : {}),
  }
}

function mapStepToDetail(step: Step): FlowDetail['steps'][number] {
  switch (step.type) {
    case 'Question': {
      return {
        id: step.id,
        type: 'Question',
        text: step.text,
        ...(step.yesNext ? { yesNext: step.yesNext } : {}),
        ...(step.noNext ? { noNext: step.noNext } : {}),
        ...(step.barrierId ? { barrierId: step.barrierId } : {}),
        ...(step.image ? { image: step.image } : {}),
        ...(step.images ? { images: step.images } : {}),
        ...(step.checkPreviousNos ? { checkPreviousNos: step.checkPreviousNos } : {}),
        ...(step.conditionalYesNext
          ? { conditionalYesNext: step.conditionalYesNext.map(mapConditionalNextToDetail) }
          : {}),
        ...(step.conditionalNoNext
          ? { conditionalNoNext: step.conditionalNoNext.map(mapConditionalNextToDetail) }
          : {}),
      }
    }
    case 'Form': {
      return {
        id: step.id,
        type: 'Form',
        title: step.title,
        ...(step.next ? { next: step.next } : {}),
        ...(step.barrierId ? { barrierId: step.barrierId } : {}),
        fields: step.fields.map(f => ({
          id: f.id,
          type: f.type,
          label: f.label,
          ...(f.unit ? { unit: f.unit } : {}),
          ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        })),
        ...(step.image ? { image: step.image } : {}),
        ...(step.images ? { images: step.images } : {}),
        ...(step.metadata ? { metadata: step.metadata } : {}),
      }
    }
    case 'Select': {
      return {
        id: step.id,
        type: 'Select',
        ...(step.title ? { title: step.title } : {}),
        ...(step.text ? { text: step.text } : {}),
        ...(step.image ? { image: step.image } : {}),
        ...(step.images ? { images: step.images } : {}),
        options: step.options.map(o => ({
          label: o.label,
          ...(o.next ? { next: o.next } : {}),
          ...(o.yesNext ? { yesNext: o.yesNext } : {}),
          ...(o.noNext ? { noNext: o.noNext } : {}),
          ...(o.barrierId ? { barrierId: o.barrierId } : {}),
          ...(o.condition
            ? { condition: { stepId: o.condition.stepId, answer: o.condition.answer } }
            : {}),
        })),
      }
    }
    case 'End': {
      return {
        id: step.id,
        type: 'End',
        ...(step.image ? { image: step.image } : {}),
        ...(step.images ? { images: step.images } : {}),
      }
    }
    default: {
      const _exhaustive: never = step as never
      throw new Error(`mapStepToDetail: Tipo de Step no soportado: ${_exhaustive}`)
    }
  }
}

/**
 * Nombre de subida estable: `<stepId>_<fieldId>_<photoId>.<ext>` (BE-5).
 * `photoId` sale del nombre del archivo local (único por foto, lo genera `persistPhoto`), así que
 * reintentar un envío reutiliza el mismo nombre y no depende del orden del array ni de la hora.
 */
function photoUploadName(stepId: string, fieldId: string, localUri: string): string {
  const file = localUri.split('?')[0]?.split('/').pop() ?? ''
  const dot = file.lastIndexOf('.')
  const photoId = (dot > 0 ? file.slice(0, dot) : file) || 'photo'
  const ext = (dot > 0 ? file.slice(dot + 1) : 'jpg').toLowerCase() || 'jpg'
  return `${stepId}_${fieldId}_${photoId}.${ext}`
}

/**
 * Recorre todas las respuestas y junta las fotos locales (file://...) que haya que subir.
 */
function collectLocalPhotos(answers: Record<string, SubmissionAnswer>): PhotoToUpload[] {
  const out: PhotoToUpload[] = []
  const seen = new Set<string>()

  Object.entries(answers).forEach(([stepId, ans]) => {
    if (ans?.type !== 'Form') return

    const vals = ans.values ?? {}
    const fieldId = photoFieldKey(vals)

    extractPhotoArray(vals).forEach(p => {
      const localUri = photoUriOf(p)
      if (!localUri || !localUri.startsWith('file')) return

      const uploadName = photoUploadName(stepId, fieldId, localUri)
      if (seen.has(uploadName)) return
      seen.add(uploadName)

      const ext = uploadName.split('.').pop() ?? 'jpg'
      const mimeType: string =
        (typeof p === 'string' ? undefined : (p as PhotoValueObject).type) || guessMimeFromExt(ext)

      out.push({ stepId, localUri, uploadName, mimeType })
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
 * Procesa `items` con hasta `limit` tareas en paralelo. Si una falla, rechaza con ese error
 * (las que ya estaban en vuelo terminan solas: el PUT a la misma key es idempotente).
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item)
    }
  })
  await Promise.all(workers)
}

export function readVersion(res: RemoteAuditResponse | null | undefined): number | null {
  const v = Number(res?.version)
  return Number.isInteger(v) && v > 0 ? v : null
}

export function readStatus(res: RemoteAuditResponse | null | undefined): string | undefined {
  return typeof res?.status === 'string' && res.status ? res.status : undefined
}

/** `server_version` del body de un 409, o null si no viene. */
export function readServerVersion(err: unknown): number | null {
  const data = (err as { response?: { data?: { server_version?: unknown } } })?.response?.data
  const v = Number(data?.server_version)
  return Number.isInteger(v) && v > 0 ? v : null
}

export function extractStatus(err: unknown): number | undefined {
  const maybe = err as { response?: { status?: number } }
  return maybe?.response?.status
}

/**
 * `last_error` = JSON `{ status, error, message }` con el formato estándar del backend (BE-13).
 * Si el body no lo respeta: `HTTP <status>` + body recortado.
 */
function buildLastError(err: unknown, status?: number): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === 'object') {
    const body = data as { error?: unknown; message?: unknown }
    if (typeof body.message === 'string' && body.message.length > 0) {
      return JSON.stringify({
        status: status ?? null,
        error: typeof body.error === 'string' ? body.error : null,
        message: body.message,
      })
    }
  }
  const raw = typeof data === 'string' ? data : data ? JSON.stringify(data) : ''
  return JSON.stringify({
    status: status ?? null,
    error: null,
    message: `HTTP ${status ?? '?'}${raw ? ` ${raw.slice(0, 200)}` : ''}`,
  })
}

/** `userId` de la sesión actual para persistir junto a la submission / item de outbox. */
export function ownerFields(): { userId?: string } {
  const userId = getCurrentUserId()
  return userId ? { userId } : {}
}

export function isRecoverableStatus(status?: number): boolean {
  if (typeof status !== 'number') return true
  if (status === 429) return true
  if (status === 401 || status === 403) return true
  if (status === 408) return true
  if (status >= 500) return true
  // 4xx no recuperables: drop
  return false
}

/**
 * Convierte tus respuestas internas en lo que /audits espera.
 */
export function buildAnswersForApi(params: {
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

      const fieldId = photoFieldKey(outValues)
      const mappedUrls = rawArray.map(p => {
        const uri = photoUriOf(p)
        // Ya remoto
        if (uri.startsWith('s3://') || uri.startsWith('https://')) return uri
        // Local: tiene que haberse subido; si no, error explícito (nunca viaja un file://)
        const url = uploadMap[photoUploadName(stepId, fieldId, uri)]
        if (!url) throw new Error(`Photo not uploaded for step ${stepId}: ${uri}`)
        return url
      })

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
          // Normalizar separador decimal: coma → punto
          const normalized = trimmed.replace(/,/g, '.')
          const numVal = Number(normalized)
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
  context: { submissionId: string; projectId?: string; facilityId?: string; version?: string },
): Promise<void> {
  // Persistimos el draft en submissions (misma fila que el draft de la corrida)
  const { id } = await submissionRepo.saveDraft({
    id: context.submissionId,
    draft,
    projectId: context.projectId ?? '',
    facilityId: context.facilityId ?? '',
    version: context.version ?? '',
    ...ownerFields(),
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
    ...ownerFields(),
  })

  await submissionRepo.markStatus(id, 'queued')

  if (__DEV__) {
    console.log('[OUTBOX] Enqueued AUDIT_SUBMISSION', { submissionId: id })
  }
}
