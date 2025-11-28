import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { loginUseCase } from '@features/auth/application/usecases'
import { saveSession, getSnapshot, getValidToken } from '@shared/session/session'
import { normalizeAuthError } from '../lib/utils'

// Schema de login (mismo que tenías en LoginScreen)
const LoginSchema = z.object({
  username: z
    .string()
    .min(1, 'The user is mandatory.')
    .min(3, 'Minimum 3 characters.')
    .max(30, 'Maximum 30 characters.'),
  password: z.string().min(6, 'Minimum 6 characters.'),
})

export type LoginForm = z.infer<typeof LoginSchema>

export type UseLoginResult = {
  control: ReturnType<typeof useForm<LoginForm>>['control']
  handleSubmit: ReturnType<typeof useForm<LoginForm>>['handleSubmit']
  formState: ReturnType<typeof useForm<LoginForm>>['formState']
  passwordRef: React.RefObject<any>
  submitting: boolean
  submitError: string | null
  checkingSession: boolean
  onSubmit: (data: LoginForm) => Promise<void>
}

/**
 * useLogin
 *
 * Responsabilidades:
 * - Manejar formulario de login (react-hook-form + zod).
 * - Ejecutar loginUseCase + saveSession.
 * - Navegar a /(app)/projects luego de login exitoso.
 * - En el montaje:
 *    - Si hay refreshToken:
 *        - Intenta getValidToken():
 *           - Si el refresh es válido → saltea login y navega a /(app)/projects.
 *           - Si el refresh es inválido → getValidToken() limpia sesión y te deja en login.
 *           - Si el error es transitorio (red, Cognito caído) pero sigue habiendo refreshToken →
 *             consideramos la sesión como válida y también salteamos login (útil para offline).
 *    - Si NO hay refreshToken → login normal.
 */
export const useLogin = (): UseLoginResult => {
  const router = useRouter()

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState<boolean>(true)

  const passwordRef = useRef(null)

  const { control, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    mode: 'onChange',
    defaultValues: { username: '', password: '' },
  })

  // -----------------------
  // Auto-skip del login
  // -----------------------
  useEffect(() => {
    let cancelled = false

    const bootstrapSession = async () => {
      try {
        const snap = getSnapshot()

        // Si no hay refreshToken, no intentamos nada: mostramos login.
        if (!snap.refreshToken) {
          return
        }

        try {
          // Esto:
          // - Usa IdToken si sigue vigente.
          // - O hace REFRESH_TOKEN_AUTH si ya expiró.
          await getValidToken()
        } catch (err) {
          // getValidToken() sólo hace clearSession() cuando detecta
          // que el refresh token es inválido / expirado (NotAuthorized, etc.).
          const after = getSnapshot()

          if (!after.refreshToken) {
            // RefreshToken realmente inválido → nos quedamos en login.
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.warn('[useLogin] Refresh token invalid/expired, staying on login', err)
            }
            return
          }

          // Si seguimos teniendo refreshToken, interpretamos el error
          // como transitorio (red / Cognito caído).
          // Para no romper el uso offline, dejamos pasar y hacemos auto-login igual.
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[useLogin] Transient error validating session, auto-login anyway', err)
          }
        }

        // Si llegamos acá y no se limpió la sesión, consideramos
        // que hay sesión activa y saltamos el login.
        if (!cancelled) {
          router.replace('/(app)/projects')
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false)
        }
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [router])

  // -----------------------
  // Submit de login
  // -----------------------
  const onSubmit = useCallback(
    async (data: LoginForm) => {
      if (submitting) return

      setSubmitting(true)
      setSubmitError(null)

      try {
        const tokens = await loginUseCase(data.username.trim(), data.password)
        await saveSession(tokens)
        router.replace('/(app)/projects')
      } catch (e) {
        setSubmitError(normalizeAuthError(e))
      } finally {
        setSubmitting(false)
      }
    },
    [router, submitting],
  )

  return {
    control,
    handleSubmit,
    formState,
    passwordRef,
    submitting,
    submitError,
    checkingSession,
    onSubmit,
  }
}
