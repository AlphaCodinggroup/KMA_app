import axios, { AxiosHeaders } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import { Env } from '@shared/config/env'
import { clearSession, getValidToken } from '@shared/session/session'
import { isOnlineOnce } from '@shared/lib/network'

/**
 * http.ts
 *
 * Responsabilidades:
 * 1. Instancia Axios autenticada contra el backend KMA (baseURL = Env.apiBaseUrl),
 *    que se usa para:
 *      - POST /uploads  -> pedir presigned URLs para fotos
 *      - POST /audits   -> crear la auditoría final
 *    Ambos requieren Authorization: Bearer <token>.
 *
 * 2. Manejo de expiración de sesión:
 *    - Cada request intenta inyectar Authorization.
 *    - Si el backend responde 401, se intenta renovar el token una sola vez
 *      (cola de refresh). Si no se puede, se limpia la sesión.
 *
 * 3. Resiliencia de red en campo:
 *    - Reintentos con backoff exponencial en 429 / 5xx.
 *
 * 4. Helper `putPresignedBinary`:
 *    - Sube binarios (fotos) directo a S3 usando la upload_url presignada
 *      que devolvió el backend en /uploads.
 *    - NO manda Authorization (la URL ya viene firmada).
 *    - Retrys sólo en errores temporales (5xx / 429). 403 no se reintenta
 *      porque indica URL expirada/firma inválida.
 *
 */

// --- Utilidades de backoff
function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

function expoBackoffDelay(attempt: number, baseMs: number): number {
  const max = baseMs * Math.pow(2, attempt)
  return Math.floor(Math.random() * max)
}

// Marcadores internos para evitar loops
const RETRIED = Symbol('retried')
const RETRIED_401 = Symbol('retried401')

// ------------------- Refresh con cola (una sola renovación) -------------------
let refreshPromise: Promise<string | null> | null = null

function scheduleRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const token = await getValidToken()
        return token ?? null
      } catch {
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

// --- Crear instancia principal autenticada contra nuestro backend
export const http: AxiosInstance = axios.create({
  baseURL: Env.apiBaseUrl,
  timeout: 20_000,
})

// --- Interceptor de request: Authorization (+ opcional Idempotency-Key)
http.interceptors.request.use(async config => {
  try {
    const token = await getValidToken()
    if (token) {
      const headers = new AxiosHeaders(config.headers)
      headers.set('Authorization', `Bearer ${token}`)
      config.headers = headers
    }
  } catch {
    // Si falla, dejamos que el backend responda 401 y se maneje abajo.
  }
  return config
})

// -------------------- Helpers de retry --------------------
function getSafeRetryParams() {
  const maxAttempts = Number(Env.retry.maxAttempts ?? 3)
  const baseDelayMs = Number(Env.retry.baseDelayMs ?? 500)
  return {
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts >= 0 ? maxAttempts : 3,
    baseDelayMs: Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? baseDelayMs : 500,
  }
}

function isTimeout(err: AxiosError) {
  return err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')
}

function isNetworkError(err: AxiosError) {
  // Sin response suele indicar fallo de red/host
  return !err.response
}

function isRetryableStatus(status?: number) {
  if (typeof status !== 'number') return false
  if (status === 429) return true
  if (status >= 500 && status !== 501) return true
  return false
}

function isUploadsPresignRequest(cfg?: AxiosRequestConfig) {
  if (!cfg?.url) return false
  const url = String(cfg.url).toLowerCase()
  const method = String(cfg.method ?? 'get').toLowerCase()
  // Nunca reintentar presign de /uploads
  return url.endsWith('/uploads') && method === 'post'
}

// --- Interceptor de respuesta
http.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const config = error.config as AxiosRequestConfig & {
      [RETRIED]?: number
      [RETRIED_401]?: boolean
    }
    const status = error.response?.status

    // ----------------------------- 401 con cola -----------------------------
    if (status === 401 && config && !config[RETRIED_401]) {
      config[RETRIED_401] = true

      const newToken = await scheduleRefresh()

      if (newToken) {
        const headers = new AxiosHeaders(config.headers)
        headers.set('Authorization', `Bearer ${newToken}`)
        config.headers = headers
        return http.request(config)
      }

      try {
        await clearSession()
      } catch {
        // ignore
      }
      return Promise.reject(error)
    }

    // ------------------------- Retry/backoff 429 y 5xx ----------------------
    if (config && !isUploadsPresignRequest(config)) {
      const retryableBase = isRetryableStatus(status) || isTimeout(error) || isNetworkError(error)

      if (retryableBase) {
        const online = await isOnlineOnce()
        if (!online) return Promise.reject(error)

        const { maxAttempts, baseDelayMs } = getSafeRetryParams()
        const attempt = Number(config[RETRIED] ?? 0)

        if (attempt < maxAttempts) {
          config[RETRIED] = attempt + 1
          const jitter = Math.floor(Math.random() * 100)
          const delay = expoBackoffDelay(attempt, baseDelayMs) + jitter
          await sleep(delay)
          return http.request(config)
        }
      }
    }

    return Promise.reject(error)
  },
)

// --- Helper genérico para requests tipados
export async function request<T = unknown>(cfg: AxiosRequestConfig): Promise<T> {
  const { data } = await http.request<T>(cfg)
  return data
}

// ------------------------ putPresignedBinary ------------------------
export interface PutPresignedBinaryArgs {
  url: string
  data: Blob | ArrayBuffer | Uint8Array
  contentType: string
  timeoutMs?: number
  maxAttempts?: number
}

export async function putPresignedBinary({
  url,
  data,
  contentType,
  timeoutMs = 20_000,
  maxAttempts = Env.retry.maxAttempts,
}: PutPresignedBinaryArgs): Promise<void> {
  const baseDelayMs = Env.retry.baseDelayMs
  let attempt = 0

  for (;;) {
    try {
      await axios.put(url, data, {
        headers: { 'Content-Type': contentType },
        timeout: timeoutMs,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
      return
    } catch (err: any) {
      const status: number | undefined = err?.response?.status

      const retryable =
        status === 429 || (typeof status === 'number' && status >= 500 && status !== 501) || !status

      if (!retryable || attempt >= maxAttempts) {
        throw err
      }

      const delay = expoBackoffDelay(attempt, baseDelayMs) + Math.floor(Math.random() * 100)
      attempt += 1
      await sleep(delay)
    }
  }
}
