import axios, { type AxiosError, type AxiosInstance } from 'axios'
import { v4 as uuidv4 } from 'uuid'
import {
  AUTH_SCHEME,
  BACKEND_BASE_URL,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
} from '@shared/config/env'
import { getAccessToken, setSessionTokens, getRefreshToken } from '@shared/session/session'

/** Firma opcional para refrescar tokens  */
export type TokenRefresher = () => Promise<{ accessToken: string; refreshToken?: string } | null>

let _refresher: TokenRefresher | null = null
let _refreshPromise: Promise<{ accessToken: string; refreshToken?: string } | null> | null = null

export function configureHttp(opts?: { tokenRefresher?: TokenRefresher }) {
  _refresher = opts?.tokenRefresher ?? null
}

export const http: AxiosInstance = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 15000,
})

// REQUEST
http.interceptors.request.use(async cfg => {
  cfg.headers = cfg.headers ?? {}

  const token = getAccessToken()
  if (token) cfg.headers.Authorization = `${AUTH_SCHEME} ${token}`

  const method = (cfg.method ?? 'get').toUpperCase()
  if (method !== 'GET' && !cfg.headers['Idempotency-Key']) {
    cfg.headers['Idempotency-Key'] = uuidv4()
  }

  return cfg
})

// RESPONSE
http.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const cfg: any = error.config ?? {}
    const status = error.response?.status
    const isNetwork = !!error.message && !error.response
    const retriable = isNetwork || status === 429 || (status && status >= 500)
    cfg.__retryCount = cfg.__retryCount ?? 0

    // 401 → intentar refresh
    if (status === 401 && _refresher && !cfg.__didRefresh) {
      try {
        if (!_refreshPromise) _refreshPromise = _refresher()
        const newTokens = await _refreshPromise
        _refreshPromise = null

        if (newTokens?.accessToken) {
          setSessionTokens({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken ?? getRefreshToken() ?? undefined,
          })
          cfg.__didRefresh = true
          cfg.headers = cfg.headers ?? {}
          cfg.headers.Authorization = `${AUTH_SCHEME} ${newTokens.accessToken}`
          return http(cfg)
        }
      } catch {
        _refreshPromise = null
      }
    }

    if (retriable && cfg.__retryCount < RETRY_MAX_ATTEMPTS) {
      cfg.__retryCount++
      const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (cfg.__retryCount - 1), 10_000)
      const jitter = Math.floor(Math.random() * 250)
      await new Promise(r => setTimeout(r, delay + jitter))
      return http(cfg)
    }

    return Promise.reject(error)
  },
)
