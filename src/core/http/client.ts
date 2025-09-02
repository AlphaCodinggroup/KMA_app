/**
 * @file Cliente HTTP centralizado (axios) con:
 * - Bearer token desde expo-secure-store.
 * - Idempotencia en mutaciones (header `Idempotency-Key`).
 * - Refresh token en 401 (intento único).
 * - Reintentos con backoff exponencial para 5xx/errores de red (solo en requests idempotentes).
 */

import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import * as SecureStore from 'expo-secure-store'
import { v4 as uuidv4 } from 'uuid'
import { CONFIG } from '@shared/config'

/** Claves de almacenamiento seguro */
const TOKEN_KEY = 'auth_token'
const REFRESH_KEY = 'refresh_token'

/** Config extendida con flags internos de retry/refresh */
type RetriableConfig<D = unknown> = InternalAxiosRequestConfig<D> & {
  _retry?: boolean
  _attempts?: number
}

/** Helper: delay */
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

/** Métodos idempotentes / mutaciones */
const isIdempotent = (m?: string): boolean =>
  ['get', 'head', 'options'].includes((m ?? '').toLowerCase())

const isMutating = (m?: string): boolean =>
  ['post', 'put', 'patch', 'delete'].includes((m ?? '').toLowerCase())

/** Respuesta esperada del endpoint de refresh */
type AuthRefreshResponse = { accessToken: string }

/** Instancia Axios */
const client: AxiosInstance = axios.create({
  baseURL: CONFIG.BACKEND_BASE_URL,
  timeout: 15000,
})

/** Request interceptor: auth + idempotencia */
client.interceptors.request.use(async (config: RetriableConfig) => {
  // Aseguramos instancia de AxiosHeaders (evita problemas con exactOptionalPropertyTypes)
  const headers = new AxiosHeaders(config.headers || {})
  config.headers = headers

  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Idempotencia para mutaciones
  if (isMutating(config.method) && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', uuidv4())
  }

  return config
})

/** Response interceptor: refresh 401 + retry 5xx/red */
client.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const cfg = (error.config ?? {}) as RetriableConfig
    const status = error.response?.status

    // 401 -> intento único de refresh
    if (status === 401 && !cfg._retry) {
      cfg._retry = true
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY)
      if (refresh) {
        try {
          const resp = await axios.post<AuthRefreshResponse>(
            `${CONFIG.BACKEND_BASE_URL}/auth/refresh`,
            { refreshToken: refresh },
          )

          const newToken = resp.data?.accessToken
          if (newToken) {
            await SecureStore.setItemAsync(TOKEN_KEY, newToken)
            const headers = new AxiosHeaders(cfg.headers || {})
            headers.set('Authorization', `Bearer ${newToken}`)
            cfg.headers = headers
            return client(cfg)
          }
        } catch {
          // Dejar propagar; el caller debería manejar logout/limpieza de sesión
        }
      }
    }

    // Retry controlado para 5xx o errores de red (solo idempotentes)
    const retriable = isIdempotent(cfg.method)
      ? status
        ? status >= 500 && status < 600
        : true // sin status => error de red/timeout
      : false

    if (retriable) {
      cfg._attempts = (cfg._attempts ?? 0) + 1
      if (cfg._attempts <= CONFIG.RETRY_MAX_ATTEMPTS) {
        const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, cfg._attempts - 1)
        await sleep(delay)
        return client(cfg)
      }
    }

    return Promise.reject(error)
  },
)

export { client, TOKEN_KEY, REFRESH_KEY }
