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

// --- Crear instancia
export const http: AxiosInstance = axios.create({
  baseURL: Env.apiBaseUrl,
  timeout: 20_000,
})

// --- Interceptor de request: Authorization + (opcional) Idempotency-Key
http.interceptors.request.use(async config => {
  try {
    const token = await getValidToken()
    const headers = new AxiosHeaders(config.headers)
    headers.set('Authorization', `Bearer ${token}`)

    // Idempotency-Key si se quiere forzar (por defecto respetamos la que venga)
    // if (!headers.has('Idempotency-Key')) {
    //   headers.set('Idempotency-Key', uuid())
    // }

    config.headers = headers
  } catch {}
  return config
})

// --- Interceptor de respuesta: 401 → refresh + retry | 429/5xx → backoff
http.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const config = error.config as AxiosRequestConfig & {
      [RETRIED]?: number
      [RETRIED_401]?: boolean
    }

    const status = error.response?.status

    // 401: intentar forzar token válido y reintentar una sola vez
    if (status === 401 && config && !config[RETRIED_401]) {
      config[RETRIED_401] = true
      try {
        const token = await getValidToken()
        const headers = new AxiosHeaders(config.headers)
        headers.set('Authorization', `Bearer ${token}`)
        config.headers = headers
        return http.request(config)
      } catch {
        await clearSession()
        return Promise.reject(error)
      }
    }

    // Retry/backoff para 429 y 5xx (o timeouts sin status)
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
