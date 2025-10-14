import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios'
import { getValidToken, clearSession } from '@shared/session/session'

/**
 * Interfaz de integración para no duplicar lógica:
 * - refreshFn: debe obtener y persistir un nuevo access token (y refresh si corresponde)
 *              y devolver el access token actualizado (string no vacío).
 * - onLogout: acción centralizada para cerrar sesión (limpiar estado, navegar a login, etc.)
 */
export interface AuthInterceptorDeps {
  refreshFn: () => Promise<string> // devuelve el nuevo access token
  onLogout: () => Promise<void>
}

/** Marca interna para evitar loops de reintento 401 */
const RETRIED_401 = Symbol('retried401')

/** Cola de espera durante el refresh (una sola renovación concurrente) */
type PendingRequest = {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

let isRefreshing = false
let queue: PendingRequest[] = []

function enqueue(resolve: (t: string) => void, reject: (e: unknown) => void): void {
  queue.push({ resolve, reject })
}

function drainQueueOk(token: string): void {
  queue.forEach(p => p.resolve(token))
  queue = []
}

function drainQueueErr(err: unknown): void {
  queue.forEach(p => p.reject(err))
  queue = []
}

/**
 * Agrega el header Authorization si hay token válido.
 * Nota: interceptor de request puede ser async sin problemas.
 */
async function attachAuthHeader(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  if (!config.headers?.Authorization) {
    const token = await getValidToken()
    if (token) {
      const h = { ...(config.headers ?? {}) }
      h.Authorization = `Bearer ${token}`
      config.headers = h
    }
  }
  return config
}

/**
 * Manejo de 401 con cola de refresh:
 * - Si ya estamos refrescando: el request espera en la cola y reintenta con el nuevo token.
 * - Si no: disparamos refreshFn una sola vez y luego reintentamos todos.
 */
function handleResponseError(instance: AxiosInstance, deps: AuthInterceptorDeps) {
  return async (error: AxiosError): Promise<unknown> => {
    const resp = error.response
    const original = error.config as (AxiosRequestConfig & { [RETRIED_401]?: boolean }) | undefined

    // Si no hay response o no es 401, rechazamos normal
    if (!resp || resp.status !== 401 || !original) {
      throw error
    }

    // Evitar loop infinito en el mismo request
    if (original[RETRIED_401]) {
      throw error
    }

    // Si ya hay un refresh en curso, encolamos y reintentamos cuando termine
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        enqueue(
          (newToken: string) => {
            try {
              const cfg: AxiosRequestConfig = {
                ...original,
                headers: { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` },
              }
              // Marcamos para no caer otra vez aquí si vuelve a dar 401
              cfg[RETRIED_401] = true
              resolve(instance.request(cfg))
            } catch (e) {
              reject(e)
            }
          },
          (err: unknown) => {
            reject(err)
          },
        )
      })
    }

    // Disparamos refresh
    isRefreshing = true
    original[RETRIED_401] = true

    try {
      const newToken = await deps.refreshFn()
      // Avísamos a la cola que hay token nuevo
      drainQueueOk(newToken)
      // Reintentamos el request original con el token renovado
      const cfg: AxiosRequestConfig = {
        ...original,
        headers: { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` },
      }
      return instance.request(cfg)
    } catch (e) {
      // Falla el refresh → limpieza de sesión y rechazo de todo
      try {
        await deps.onLogout()
      } finally {
        await clearSession()
      }
      drainQueueErr(e)
      throw e
    } finally {
      isRefreshing = false
    }
  }
}

/**
 * Instalación de interceptores de Auth en una instancia axios.
 * Idempotente: si lo llamás dos veces, axios no duplica handlers
 */
export function installAuthInterceptors(instance: AxiosInstance, deps: AuthInterceptorDeps): void {
  instance.interceptors.request.use(attachAuthHeader)
  instance.interceptors.response.use(
    // Passthrough OK
    r => r,
    // 401 handler con cola
    handleResponseError(instance, deps),
  )
}
