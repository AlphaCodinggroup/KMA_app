import { clearSession, getSnapshot } from '@shared/session/session'
import { globalSignOutUseCase } from './usecases'

/**
 * Cierra la sesión del usuario en el dispositivo.
 * Best-effort:
 *  - Revoca sesión en Cognito (GlobalSignOut) usando AccessToken.
 *  - Limpia tokens locales (SecureStore + caché)
 */
export async function logoutUseCase(): Promise<void> {
  const snap = getSnapshot()
  if (snap.accessToken) {
    await globalSignOutUseCase(snap.accessToken)
  }

  await clearSession()
}

/**
 * Helper: saber si hay sesión activa sin forzar refresh.
 * Útil para toggles de UI (mostrar/ocultar botón “Logout”).
 */
export function hasActiveSession(): boolean {
  const snap = getSnapshot()
  return Boolean(snap.idToken)
}
