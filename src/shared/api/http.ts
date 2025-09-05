import axios from 'axios'
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { ENV } from '@shared/config/env'

type RetryState = {
  _retryCount?: number
  _didRefresh?: boolean
}

/** Idempotency key explícita. Si no viene y autoIdempotency está activo, se genera. */
export type HttpConfig = AxiosRequestConfig & {
  idempotencyKey?: string
}

let tokenProvider: () => Promise<string | undefined> = async () => undefined
let tokenRefresher: (() => Promise<string | undefined>) | undefined
let isRefreshing = false
const refreshQueue: Array<(t?: string) => void> = []

// Flag configurable para auto-generar Idempotency-Key en métodos mutantes
let autoIdempotency = true

export function configureHttp(
  opts: {
    getAccessToken?: () => Promise<string | undefined> | string | undefined
    /** Debe refrescar y devolver el nuevo access token (ya guardado por fuera). */
    refreshToken?: () => Promise<string | undefined>
    autoIdempotency?: boolean
  } = {},
) {
  if (opts.getAccessToken) {
    tokenProvider = async () =>
      Promise.resolve(
        typeof opts.getAccessToken === 'function' ? await opts.getAccessToken() : undefined,
      )
  }
  tokenRefresher = opts.refreshToken
  if (typeof opts.autoIdempotency === 'boolean') autoIdempotency = opts.autoIdempotency
}

export const http: AxiosInstance = axios.create({
  baseURL: ENV.BACKEND_BASE_URL,
  timeout: 15000,
})

// ---------- Request: Auth + Idempotency ----------
http.interceptors.request.use(async (config: HttpConfig) => {
  config.headers = config.headers ?? {}

  // Auth (async-friendly)
  const token = await tokenProvider?.()
  if (token) {
    ;(config.headers as any).Authorization = `${ENV.AUTH_SCHEME} ${token}`
  }

  // Idempotency: si no viene y está activo, generamos para métodos mutantes
  const method = (config.method ?? 'get').toUpperCase()
  const isMutating = method !== 'GET'
  if (isMutating) {
    const key = config.idempotencyKey ?? (config.headers as any)['Idempotency-Key']
    if (!key && autoIdempotency) {
      ;(config.headers as any)['Idempotency-Key'] = uuidv4()
    } else if (key) {
      ;(config.headers as any)['Idempotency-Key'] = key
    }
  }

  return config
})

// ---------- Helpers retry ----------
function isCanceled(error: AxiosError) {
  return (error as any)?.code === 'ERR_CANCELED' || error.name === 'CanceledError'
}

function shouldRetry(error: AxiosError) {
  if (isCanceled(error)) return false
  if (error.code === 'ECONNABORTED') return true
  if (!error.response) return true
  const status = error.response.status
  if (status === 408 || status === 425 || status === 429) return true
  if (status >= 500 && status <= 599) return true
  return false
}

function parseRetryAfterMs(error: AxiosError): number | null {
  const h = error.response?.headers
  const ra = h?.['retry-after'] ?? h?.['Retry-After']
  if (!ra) return null
  const asNumber = Number(ra)
  if (!Number.isNaN(asNumber)) return Math.max(0, asNumber * 1000)
  const dateMs = Date.parse(String(ra))
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now())
  return null
}

function calcDelayMs(error: AxiosError, attempt: number): number {
  const ra = parseRetryAfterMs(error)
  if (ra != null) return Math.min(ra, 30_000)

  const base = ENV.RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.floor(Math.random() * 250)
  return Math.min(base + jitter, 10_000)
}

// ---------- Response: refresh 401  ----------
http.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as HttpConfig & RetryState

    // 401 → intentar refresh y sólo una vez por request
    if (error.response?.status === 401 && tokenRefresher && original && !original._didRefresh) {
      if (!isRefreshing) {
        isRefreshing = true
        try {
          const newToken = await tokenRefresher()
          // Despertamos a todos los encolados con el token
          refreshQueue.forEach(resolve => resolve(newToken))
        } finally {
          isRefreshing = false
          refreshQueue.length = 0
        }
      }

      // Esperamos el resultado del refresh encolado
      const nextToken = await new Promise<string | undefined>(resolve => {
        refreshQueue.push(resolve)
      })

      if (nextToken) {
        original._didRefresh = true
        original.headers = original.headers ?? {}
        ;(original.headers as any).Authorization = `${ENV.AUTH_SCHEME} ${nextToken}`
        return http(original)
      }
      // Si no hay token nuevo, caemos al reject sin reintento automático
    }

    if (original && shouldRetry(error)) {
      const attempt = original._retryCount ?? 0
      if (attempt < ENV.RETRY_MAX_ATTEMPTS) {
        original._retryCount = attempt + 1
        const delay = calcDelayMs(error, attempt)
        await new Promise(r => setTimeout(r, delay))
        return http(original)
      }
    }

    // Caso no recuperable
    return Promise.reject(error)
  },
)
