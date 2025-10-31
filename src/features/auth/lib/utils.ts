import { SessionError } from '@entities/user/model'

export function normalizeAuthError(e): string {
  // Errores de dominio
  if (e instanceof SessionError) {
    if (e.code === 'PERSISTENCE_FAILED') {
      return 'Could not securely store the session on this device.'
    }
    if (e.code === 'CORRUPTED_DATA') {
      return 'Session data is corrupted. Please try again.'
    }
  }

  // Axios con respuesta de Cognito
  const type = e?.response?.data?.__type || e?.response?.data?.code || e?.code
  const msg = String(e?.message ?? e)

  if (/NotAuthorizedException/i.test(type) || /NotAuthorized/i.test(msg)) {
    return 'Invalid username or password.'
  }
  if (/UserNotFoundException/i.test(type) || /User.*not.*found/i.test(msg)) {
    return 'User does not exist.'
  }
  if (/UserNotConfirmedException/i.test(type)) {
    return 'User not confirmed.'
  }
  if (/PasswordResetRequiredException/i.test(type)) {
    return 'Password reset required.'
  }
  if (/TooManyRequestsException|ThrottlingException/i.test(type) || e?.response?.status === 429) {
    return 'Too many attempts. Please try again later.'
  }
  if (e?.code === 'ECONNABORTED' || /timeout/i.test(msg)) {
    return 'Request timed out. Please try again.'
  }
  if (/Network Error/i.test(msg)) {
    return 'No internet connection.'
  }

  return 'Unexpected error while logging in.'
}
