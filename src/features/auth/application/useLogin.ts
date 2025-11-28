import { useCallback, useState } from 'react'
import { loginUseCase } from '@features/auth/application/usecases'
import { saveSession } from '@shared/session/session'
import { normalizeAuthError } from '@features/auth/lib/utils'

export type UseLoginResult = {
  submitting: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  resetError: () => void
}

/**
 * Hook de aplicación para el flujo de login.
 *
 * Responsabilidades:
 * - Ejecutar loginUseCase con username/password.
 * - Persistir tokens vía saveSession().
 * - Exponer estado de `submitting` y `error` listo para la UI.
 * - No conocer de navegación (la decide la pantalla).
 */
export const useLogin = (): UseLoginResult => {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const login = useCallback(
    async (rawUsername: string, password: string): Promise<boolean> => {
      if (submitting) return false

      const username = rawUsername.trim()
      if (!username || !password) {
        setError('User and password are required.')
        return false
      }

      setSubmitting(true)
      setError(null)

      try {
        const tokens = await loginUseCase(username, password)
        await saveSession(tokens)
        return true
      } catch (e) {
        const message = normalizeAuthError(e)
        setError(message)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [submitting],
  )

  return {
    submitting,
    error,
    login,
    resetError,
  }
}
