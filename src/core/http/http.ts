import axios, { AxiosHeaders } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import { Env } from '@shared/config/env'
import { clearSession, getValidToken } from '@shared/session/session'

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

/**
 * Dispara (o reutiliza) un refresh/validación de token usando getValidToken().
 * - Debe resolver con un access token válido (string no vacío) o null si no pudo obtenerlo.
 * - Evita múltiples refresh concurrentes.
 */
function scheduleRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const token = await getValidToken()
        return token ?? null
      } catch {
        return null
      } finally {
        // liberar la promesa una vez resuelta/rechazada
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

// --- Crear instancia
export const http: AxiosInstance = axios.create({
  baseURL: Env.apiBaseUrl,
  timeout: 20_000,
})

// --- Interceptor de request: Authorization + Idempotency-Key
http.interceptors.request.use(async config => {
  try {
    const token = await getValidToken()
    if (token) {
      const headers = new AxiosHeaders(config.headers)
      headers.set('Authorization', `Bearer ${token}`)
      // Idempotency-Key si querés forzar (dejamos comentado para no duplicar claves)
      // if (!headers.has('Idempotency-Key')) {
      //   headers.set('Idempotency-Key', uuid())
      // }
      config.headers = headers
    }
  } catch {
    // Si falla la lectura/refresh del token, dejamos que el request siga sin header:
    // la API devolverá 401 y lo manejamos en el interceptor de respuesta.
  }
  return config
})

// --- Interceptor de respuesta: 401 → refresh con cola + retry | 429/5xx → backoff
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

      // Si ya hay un refresh ejecutándose, lo esperamos; si no, lo iniciamos.
      const newToken = await scheduleRefresh()

      if (newToken) {
        // Reintentar el request original con el token renovado
        const headers = new AxiosHeaders(config.headers)
        headers.set('Authorization', `Bearer ${newToken}`)
        config.headers = headers
        return http.request(config)
      }

      // Sin token renovado → limpiar sesión y rechazar
      try {
        await clearSession()
      } catch {}
      return Promise.reject(error)
    }

    // ------------------------- Retry/backoff 429 y 5xx ----------------------
    const shouldRetry =
      status === 429 || (typeof status === 'number' ? status >= 500 : !!error.code)
    if (config && shouldRetry) {
      const attempt = (config[RETRIED] ?? 0) as number
      if (attempt < Env.retry.maxAttempts) {
        config[RETRIED] = attempt + 1
        const delay = expoBackoffDelay(attempt, Env.retry.baseDelayMs)
        await sleep(delay)
        return http.request(config)
      }
    }

    return Promise.reject(error)
  },
)

// --- Helper para realizar requests tipadas
export async function request<T = unknown>(cfg: AxiosRequestConfig): Promise<T> {
  const { data } = await http.request<T>(cfg)
  return data
}
