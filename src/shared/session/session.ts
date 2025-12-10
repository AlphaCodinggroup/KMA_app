import { AppState } from 'react-native'
import { refreshTokensUseCase, type LoginTokens } from '@features/auth/application/usecases'
import { SessionError, type SessionRecord } from '@entities/user/model'
import type { UserSessionRepo } from '@entities/user/ports'
import { createUserSessionSecureRepo } from '@core/repos/user.secure-store.repo'

// --- Tipos públicos
export type SessionSnapshot = {
  idToken: string | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null // epoch ms
}

export type SessionEvent =
  | { type: 'login'; snapshot: SessionSnapshot }
  | { type: 'logout' }
  | { type: 'refresh'; snapshot: SessionSnapshot }
  | { type: 'change'; snapshot: SessionSnapshot }

// --- Config
const EXPIRY_SKEW_SEC = 30 // vencer antes para evitar 401 por reloj del dispositivo

// --- Dependencias (DI): repo de sesión – por defecto, SecureStore
let repo: UserSessionRepo = createUserSessionSecureRepo()
export function setSessionRepo(custom: UserSessionRepo) {
  repo = custom
}

// Caché en memoria
const mem: SessionSnapshot = { idToken: null, accessToken: null, refreshToken: null, expiresAt: null }

// Observadores simples
const listeners = new Set<(e: SessionEvent) => void>()
function emit(e: SessionEvent) {
  listeners.forEach(cb => {
    try {
      cb(e)
    } catch {
      // noop
    }
  })
}

// Control de refresh concurrente (single-flight)
let inflightRefresh: Promise<string> | null = null

// --- Utilidades
function isExpired(expiresAt: number | null, skewSec = EXPIRY_SKEW_SEC): boolean {
  if (!expiresAt) return true
  return Date.now() >= expiresAt - skewSec * 1000
}

function snapshot(): SessionSnapshot {
  return { ...mem }
}

function toSnapshot(r: SessionRecord | null): SessionSnapshot {
  if (!r)
    return { idToken: null, accessToken: null, refreshToken: null, expiresAt: null }
  return {
    idToken: r.idToken,
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiresAt: r.expiresAt,
  }
}

// --- API pública
export async function initSession(): Promise<SessionSnapshot> {
  const rec = await repo.read()
  mem.idToken = rec?.idToken ?? null
  mem.accessToken = rec?.accessToken ?? null
  mem.refreshToken = rec?.refreshToken ?? null
  mem.expiresAt = rec?.expiresAt ?? null

  // Hook: al volver a foreground, si expira, intentar refresh best-effort
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      if (mem.refreshToken && isExpired(mem.expiresAt)) {
        void getValidToken().catch(() => {
          /* noop */
        })
      }
    }
  })

  const snap = snapshot()
  emit({ type: 'change', snapshot: snap })
  return snap
}

export async function saveSession(tokens: LoginTokens): Promise<void> {
  const rec: SessionRecord = {
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  }

  try {
    await repo.save(rec)
  } catch (e: any) {
    if (e?.name === 'SessionError') throw e
    throw new SessionError('PERSISTENCE_FAILED', String(e?.message ?? e))
  }

  mem.idToken = rec.idToken
  mem.accessToken = rec.accessToken
  mem.refreshToken = rec.refreshToken
  mem.expiresAt = rec.expiresAt

  const snap = snapshot()
  emit({ type: 'login', snapshot: snap })
  emit({ type: 'change', snapshot: snap })
}

export async function clearSession(): Promise<void> {
  await repo.clear()
  mem.idToken = null
  mem.accessToken = null
  mem.refreshToken = null
  mem.expiresAt = null
  emit({ type: 'logout' })
  emit({ type: 'change', snapshot: snapshot() })
}

export function getSnapshot(): SessionSnapshot {
  return snapshot()
}

/**
 * Devuelve un IdToken válido para usar en Authorization: Bearer <IdToken>.
 *
 * - Si el token en memoria sigue vigente → lo devuelve.
 * - Si está vencido y hay RefreshToken → intenta REFRESH_TOKEN_AUTH vía refreshTokensUseCase.
 * - Si Cognito responde NotAuthorized (refresh expirado / inválido) → hace logout forzado.
 *
 * Single-flight:
 * - Múltiples llamados concurrentes comparten el mismo refresh en curso.
 */
export async function getValidToken(): Promise<string> {
  // Token en memoria aún válido
  if (mem.idToken && !isExpired(mem.expiresAt)) {
    return mem.idToken
  }

  // Sin refreshToken -> no hay forma de recuperar sesión
  if (!mem.refreshToken) {
    throw new SessionError('UNAUTHORIZED', 'Missing refresh token')
  }

  // Refresh single-flight
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      try {
        const next = await refreshTokensUseCase(mem.refreshToken as string)

        // Persistimos sólo cambios de IdToken / expiración.
        // El RefreshToken se conserva (Cognito no lo rota por defecto).
        const updated: SessionRecord = {
          idToken: next.idToken,
          accessToken: next.accessToken,
          refreshToken: mem.refreshToken as string,
          expiresAt: next.expiresAt,
        }

        await repo.save(updated)

        mem.idToken = updated.idToken
        mem.accessToken = updated.accessToken
        mem.refreshToken = updated.refreshToken
        mem.expiresAt = updated.expiresAt

        const snap = toSnapshot(updated)
        emit({ type: 'refresh', snapshot: snap })
        emit({ type: 'change', snapshot: snap })

        return updated.idToken
      } catch (e: any) {
        // Diferenciamos "refresh token inválido/expirado" de errores de red.
        const code = (e?.code ?? e?.name) as string | undefined
        const message = typeof e?.message === 'string' ? e.message : ''

        const normalizedMsg = message.toLowerCase()

        const isNotAuthorized =
          code === 'NotAuthorizedException' ||
          code === 'NOT_AUTHORIZED' ||
          code === 'REFRESH_TOKEN_EXPIRED' ||
          normalizedMsg.includes('notauthorizedexception') ||
          normalizedMsg.includes('not authorized') ||
          normalizedMsg.includes('refresh token has expired')

        if (isNotAuthorized) {
          // RefreshToken expirado → logout forzado.
          try {
            await clearSession()
          } catch {
            // ignoramos errores de limpieza
          }
        }

        // Propagamos el error para que:
        // - http.scheduleRefresh() lo traduzca a null y deje de reintentar
        // - otros callers puedan reaccionar si lo necesitan
        throw e
      } finally {
        inflightRefresh = null
      }
    })()
  }

  return inflightRefresh
}

export function subscribe(cb: (e: SessionEvent) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
