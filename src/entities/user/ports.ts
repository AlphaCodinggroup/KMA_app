import type { SessionRecord } from './model'

/**
 * Abstracción de almacenamiento de sesión.
 * Implementación concreta en infraestructura.
 */
export interface UserSessionRepo {
  save(rec: SessionRecord): Promise<void>
  read(): Promise<SessionRecord | null>
  clear(): Promise<void>
}

/**
 * Puerto para casos de uso de autenticación.
 * Las implementaciones pueden llamar a Cognito o a un BFF.
 */
export interface AuthService {
  login(params: { username: string; password: string }): Promise<SessionRecord>
  refresh(params: { refreshToken: string }): Promise<Pick<SessionRecord, 'idToken' | 'expiresAt'>>
  logout?(params: { accessToken?: string }): Promise<void>
}
