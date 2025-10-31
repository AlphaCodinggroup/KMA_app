import { AppState } from 'react-native'
import { refreshTokensUseCase, type LoginTokens } from '@features/auth/application/usecases'
import { SessionError, type SessionRecord } from '@entities/user/model'
import type { UserSessionRepo } from '@entities/user/ports'
import { createUserSessionSecureRepo } from '@core/repos/user.secure-store.repo'

// --- Tipos públicos
export type SessionSnapshot = {
  idToken: string | null
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
const mem: SessionSnapshot = { idToken: null, refreshToken: null, expiresAt: null }

// Observadores simples
const listeners = new Set<(e: SessionEvent) => void>()
function emit(e: SessionEvent) {
  listeners.forEach(cb => {
    try {
      cb(e)
    } catch {}
  })
}

// Control de refresh concurrente
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
  if (!r) return { idToken: null, refreshToken: null, expiresAt: null }
  return { idToken: r.idToken, refreshToken: r.refreshToken, expiresAt: r.expiresAt }
}

// --- API pública
export async function initSession(): Promise<SessionSnapshot> {
  const rec = await repo.read()
  mem.idToken = rec?.idToken ?? null
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
  mem.refreshToken = rec.refreshToken
  mem.expiresAt = rec.expiresAt
  const snap = snapshot()
  emit({ type: 'login', snapshot: snap })
  emit({ type: 'change', snapshot: snap })
}

export async function clearSession(): Promise<void> {
  await repo.clear()
  mem.idToken = null
  mem.refreshToken = null
  mem.expiresAt = null
  emit({ type: 'logout' })
  emit({ type: 'change', snapshot: snapshot() })
}

export function getSnapshot(): SessionSnapshot {
  return snapshot()
}

/**
 * Devuelve un bearer válido.
 * Si está a punto de expirar/expirado, refresca usando REFRESH_TOKEN_AUTH.
 * Single-flight: múltiples llamados comparten el mismo refresh en curso.
 */
export async function getValidToken(): Promise<string> {
  //token válido en memoria
  if (mem.idToken && !isExpired(mem.expiresAt)) {
    return mem.idToken
  }

  //sin refresh token, no podemos recuperar
  if (!mem.refreshToken) {
    throw new Error('NotAuthorized: missing refresh token')
  }

  //refresh single-flight
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      const next = await refreshTokensUseCase(mem.refreshToken!)
      // persistimos sólo cambios de idToken/expiración; el refreshToken se conserva
      const updated: SessionRecord = {
        idToken: next.idToken,
        refreshToken: mem.refreshToken!,
        expiresAt: next.expiresAt,
      }
      await repo.save(updated)
      mem.idToken = updated.idToken
      mem.expiresAt = updated.expiresAt
      const snap = toSnapshot(updated)
      emit({ type: 'refresh', snapshot: snap })
      emit({ type: 'change', snapshot: snap })
      return updated.idToken
    })().finally(() => {
      inflightRefresh = null
    })
  }

  return inflightRefresh
}

export function subscribe(cb: (e: SessionEvent) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
