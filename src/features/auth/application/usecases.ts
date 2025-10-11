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
 * Login con usuario/clave.
 * Retorna tokens listos para persistir. La persistencia vive en session repo (SecureStore).
 */
export async function loginUseCase(username: string, password: string): Promise<LoginTokens> {
  if (!username || !password) throw new Error('Missing credentials')

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

  const expiresAt = epochMsPlus(auth.ExpiresIn ?? 3600)

  return {
    idToken: auth.IdToken,
    accessToken: auth.IdToken, // usamos IdToken para el backend
    refreshToken: auth.RefreshToken ?? '',
    expiresAt,
  }
}

/**
 * Refresh por RefreshToken. Devuelve nuevos IdToken/AccessToken.
 * Si Cognito rechaza (NotAuthorizedException), el caller debe forzar logout.
 */
export async function refreshTokensUseCase(
  refreshToken: string,
): Promise<{ idToken: string; accessToken: string; expiresAt: number }> {
  if (!refreshToken) throw new Error('Missing refresh token')

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
    accessToken: auth.IdToken,
    expiresAt: epochMsPlus(auth.ExpiresIn ?? 3600),
  }
}

/**
 * Logout global – invalida tokens en Cognito. El caller limpia almacenamiento local luego.
 */
export async function globalSignOutUseCase(accessToken: string): Promise<void> {
  if (!accessToken) return
  await axios.post(
    Env.cognito.baseUrl,
    { AccessToken: accessToken },
    { headers: cognitoHeaders('GlobalSignOut'), timeout: 15_000 },
  )
}
