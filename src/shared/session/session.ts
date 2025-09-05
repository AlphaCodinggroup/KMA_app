import axios from 'axios'
import { ENV } from '@shared/config/env'
import { readJsonSecure, writeJsonSecure, deleteSecure } from '@shared/storage/secure'

/** Tokens de sesión */
export type SessionTokens = {
  accessToken?: string
  refreshToken?: string
  /** opcional, si el backend lo provee */
  expiresAt?: number
}

const SECURE_SESSION_KEY = 'kma.session'

let _tokens: SessionTokens = {}

/** Setea tokens en memoria y, por defecto, los persiste en SecureStore */
export function setSessionTokens(tokens?: SessionTokens | null, opts: { persist?: boolean } = {}) {
  const { persist = true } = opts
  _tokens = tokens ?? {}
  if (persist) {
    if (_tokens.accessToken || _tokens.refreshToken) {
      writeJsonSecure(SECURE_SESSION_KEY, _tokens).catch(e =>
        console.warn('[session] writeJsonSecure error:', e),
      )
    } else {
      deleteSecure(SECURE_SESSION_KEY).catch(() => {})
    }
  }
}

export function getAccessToken(): string | undefined {
  return _tokens.accessToken ?? undefined
}

export function getRefreshToken(): string | undefined {
  return _tokens.refreshToken ?? undefined
}

/** Lee SecureStore y deja la sesión en memoria. Útil en bootstrap. */
export async function loadSessionFromSecure(): Promise<SessionTokens | null> {
  try {
    const sess = await readJsonSecure<SessionTokens>(SECURE_SESSION_KEY)
    setSessionTokens(sess ?? {}, { persist: false })
    return sess ?? null
  } catch (e) {
    console.warn('[session] loadSessionFromSecure error:', e)
    return null
  }
}

/** Limpia tokens en memoria y SecureStore */
export async function clearSessionTokens(): Promise<void> {
  _tokens = {}
  await deleteSecure(SECURE_SESSION_KEY).catch(() => {})
}

/**
 * Intenta refrescar tokens contra el backend usando el refreshToken actual.
 * - Usa un axios “crudo” (sin interceptores) para evitar dependencias circulares.
 * - Si el refresh es exitoso, persiste nuevos tokens y los devuelve.
 * - Si falla, NO tira error (retorna null). Podés decidir limpiar sesión arriba.
 */
export async function refreshSessionTokens(): Promise<SessionTokens | null> {
  const rt = getRefreshToken()
  if (!rt) return null

  try {
    const client = axios.create({
      baseURL: ENV.BACKEND_BASE_URL,
      timeout: 12000,
    })

    // Ajustá el payload según tu backend
    const res = await client.post(ENV.AUTH_REFRESH_PATH, { refreshToken: rt })

    const next: SessionTokens = {
      accessToken: res.data?.accessToken,
      refreshToken: res.data?.refreshToken ?? rt, // conserva RT si no envían uno nuevo
      expiresAt: res.data?.expiresAt,
    }

    if (!next.accessToken) return null
    setSessionTokens(next) // persiste
    return next
  } catch (e) {
    console.warn('[session] refreshSessionTokens error:', e)
    return null
  }
}
