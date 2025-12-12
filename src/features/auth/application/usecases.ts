import axios from 'axios'
import { Env } from '@shared/config/env'

// Tipos básicos de respuesta Cognito
type CognitoInitiateAuthResponse = {
  AuthenticationResult?: {
    AccessToken: string
    ExpiresIn: number
    IdToken: string
    RefreshToken?: string
    TokenType: 'Bearer'
  }
  ChallengeParameters?: Record<string, unknown>
}

export type LoginTokens = {
  idToken: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Error específico de autenticación Cognito.
 * code: suele ser "NotAuthorizedException", "UserNotFoundException", etc.
 */
export class AuthError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

function epochMsPlus(seconds: number): number {
  return Date.now() + seconds * 1000
}

function cognitoHeaders(target: string) {
  return {
    'Content-Type': 'application/x-amz-json-1.1',
    'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
  }
}

/**
 * Normaliza errores de Cognito (respuesta 4xx/5xx con body) a AuthError
 * con code legible (ej: "NotAuthorizedException").
 * Si no es un error de Cognito "esperado", re-lanza el error original.
 */
function normalizeCognitoError(err: unknown): never {
  if (!axios.isAxiosError(err) || !err.response) {
    throw err
  }

  const data = err.response.data
  let rawType: string | undefined =
    data?.__type ?? data?.__Type ?? data?.code ?? data?.Code ?? data?.error

  if (typeof rawType !== 'string') {
    rawType = ''
  }

  // Formatos típicos: "NotAuthorizedException" o "com.amazon.cognitoidp#NotAuthorizedException"
  let code = rawType
  if (code.includes('#')) {
    code = code.split('#').pop() ?? code
  }

  const message: string =
    typeof data?.message === 'string'
      ? data.message
      : typeof err?.message === 'string'
        ? err.message
        : 'Cognito error'

  throw new AuthError(code || 'UnknownCognitoError', message)
}

/**
 * Login con usuario/clave.
 * Retorna tokens listos para persistir. La persistencia vive en session repo (SecureStore).
 *
 * Flujo Cognito:
 *  - AuthFlow: USER_PASSWORD_AUTH
 *  - Si credenciales inválidas → NotAuthorizedException (401/400 según configuración)
 */
export async function loginUseCase(username: string, password: string): Promise<LoginTokens> {
  if (!username || !password) throw new Error('Missing credentials')

  try {
    const { data } = await axios.post<CognitoInitiateAuthResponse>(
      Env.cognito.baseUrl,
      {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: Env.cognito.clientId,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      },
      { headers: cognitoHeaders('InitiateAuth'), timeout: 15_000 },
    )

    const auth = data.AuthenticationResult
    if (!auth?.IdToken || !auth?.AccessToken) {
      throw new Error('Invalid Cognito response')
    }

    if (!auth.RefreshToken) {
      // Sin RefreshToken no hay forma de mantener sesión a largo plazo.
      throw new Error('Missing RefreshToken in Cognito login response')
    }

    const expiresAt = epochMsPlus(auth.ExpiresIn ?? 3600)

    return {
      idToken: auth.IdToken,
      // El backend KMA usa IdToken para Authorization,
      // pero exponemos AccessToken para GlobalSignOut u otras operaciones de Cognito.
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
      expiresAt,
    }
  } catch (err) {
    // Si es error de Cognito con body, lo convertimos a AuthError con code usable.
    normalizeCognitoError(err)
  }
}

/**
 * Refresh por RefreshToken. Devuelve nuevos IdToken/AccessToken.
 *
 * Flujo Cognito:
 *  - AuthFlow: REFRESH_TOKEN_AUTH
 *
 * Si Cognito rechaza con NotAuthorizedException (ej. refresh expirado),
 * se lanza AuthError con code = "NotAuthorizedException".
 * `getValidToken()` lo usa para decidir logout forzado.
 */
export async function refreshTokensUseCase(
  refreshToken: string,
): Promise<{ idToken: string; accessToken: string; expiresAt: number }> {
  if (!refreshToken) throw new Error('Missing refresh token')

  try {
    const { data } = await axios.post<CognitoInitiateAuthResponse>(
      Env.cognito.baseUrl,
      {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: Env.cognito.clientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      },
      { headers: cognitoHeaders('InitiateAuth'), timeout: 15_000 },
    )

    const auth = data.AuthenticationResult
    if (!auth?.IdToken || !auth?.AccessToken) {
      throw new Error('Invalid Cognito refresh response')
    }

    return {
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      expiresAt: epochMsPlus(auth.ExpiresIn ?? 3600),
    }
  } catch (err) {
    normalizeCognitoError(err)
  }
}

/**
 * Logout global – invalida tokens en Cognito. El caller limpia almacenamiento local luego.
 *
 * Requiere AccessToken (NO el IdToken).
 */
export async function globalSignOutUseCase(accessToken: string): Promise<void> {
  if (!accessToken) return

  try {
    await axios.post(
      Env.cognito.baseUrl,
      { AccessToken: accessToken },
      { headers: cognitoHeaders('GlobalSignOut'), timeout: 15_000 },
    )
  } catch (err) {
    // Para logout global, si Cognito falla no vamos a bloquear la limpieza local.
    // Podés loguearlo en dev si querés.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[globalSignOutUseCase] failed', err)
    }
  }
}
