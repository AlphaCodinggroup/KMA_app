import { clearSession, getSnapshot } from '@shared/session/session'
// import { http } from '@core/http/http'
// import { Env } from '@shared/config/env'

/**
 * Cierra la sesión del usuario en el dispositivo.
 * Best-effort:
 *  - Limpia tokens locales (SecureStore + caché)
 *  - Revoca sesión en Cognito (GlobalSignOut) si guardamos accessToken
 */
export async function logoutUseCase(): Promise<void> {
  // TODO:
  // Si decidimos persistir accessToken, podemos hacer GlobalSignOut:
  // const { idToken, refreshToken } = getSnapshot()
  // const accessToken = ... // si lo persistimos en SessionRecord
  // try {
  //   await http.post('/global-sign-out', { accessToken }) // o llamada directa a Cognito
  // } catch {
  //   // best-effort: ignoramos error remoto, seguimos con clear local
  // }

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
