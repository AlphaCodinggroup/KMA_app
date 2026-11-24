import axios, { AxiosHeaders } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import { Env } from '@shared/config/env'
import { getSnapshot, getValidToken } from '@shared/session/session'
import { isOnlineOnce } from '@shared/lib/network'
import { showAuthExpiredToast } from '@shared/ui/toast/AppToast'
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
 *      (cola de refresh). Si Cognito rechaza el refresh token (NotAuthorized),
 *      `getValidToken()` limpia la sesión y se avisa con un toast. Si el refresh falla
 *      por red/timeout, el error se propaga como recuperable: no se desloguea.
 *
 * 3. Resiliencia de red en campo:
 *    - Reintentos con backoff exponencial en 429 / 5xx.
 *
 * La subida de fotos a S3 (URL presignada) vive en `fileUploader.ts`.
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

// Flag para no spamear el toast de sesión expirada
let authExpiredToastShown = false

// ------------------- Refresh con cola (una sola renovación) -------------------
let refreshPromise: Promise<string> | null = null

/** Propaga el motivo del fallo: el caller decide si fue sesión inválida o un error transitorio. */
function scheduleRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        return await getValidToken()
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
      const headers = new AxiosHeaders(
        config.headers as unknown as ConstructorParameters<typeof AxiosHeaders>[0],
      )
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

function isNoRetryRequest(cfg?: AxiosRequestConfig) {
  if (!cfg?.url) return false
  const url = String(cfg.url).toLowerCase().split('?')[0] ?? ''
  const method = String(cfg.method ?? 'get').toLowerCase()
  // Nunca reintentar el presign de /uploads ni el create de /audits: la reentrega la maneja el
  // outbox (un reintento tras un timeout podría crear la auditoría dos veces).
  return method === 'post' && (url.endsWith('/uploads') || url.endsWith('/audits'))
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

      let newToken: string
      try {
        newToken = await scheduleRefresh()
      } catch (refreshErr) {
        // `getValidToken()` sólo limpia la sesión ante NotAuthorized (refresh token inválido).
        // Sin refresh token: sesión realmente expirada → toast una sola vez.
        if (!getSnapshot().refreshToken) {
          if (!authExpiredToastShown) {
            authExpiredToastShown = true
            showAuthExpiredToast()
            // Pequeña ventana para evitar spamear toasts si llegan varios 401 seguidos
            setTimeout(() => {
              authExpiredToastShown = false
            }, 3000)
          }
          return Promise.reject(error)
        }

        // Con refresh token vigente el fallo es transitorio (red, timeout, Cognito caído):
        // rechazamos como recuperable, sin logout ni toast, para que el outbox reintente.
        return Promise.reject(refreshErr)
      }

      const headers = new AxiosHeaders(
        config.headers as unknown as ConstructorParameters<typeof AxiosHeaders>[0],
      )
      headers.set('Authorization', `Bearer ${newToken}`)
      config.headers = headers
      return http.request(config)
    }

    // ------------------------- Retry/backoff 429 y 5xx ----------------------
    if (config && !isNoRetryRequest(config)) {
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
