/**
 * Snapshot de sesión persistible a nivel dominio.
 * - idToken: se usa como Bearer en el backend
 * - accessToken: se usa para GlobalSignOut en Cognito
 * - refreshToken: para REFRESH_TOKEN_AUTH en Cognito
 * - expiresAt: epoch ms
 */
export type SessionRecord = {
  idToken: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Errores de dominio para operaciones de sesión.
 */
export class SessionError extends Error {
  readonly code: 'NOT_FOUND' | 'PERSISTENCE_FAILED' | 'CORRUPTED_DATA' | 'UNAUTHORIZED'

  constructor(code: SessionError['code'], message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'SessionError'
  }
}
