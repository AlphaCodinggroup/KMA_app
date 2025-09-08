import { useCallback, useRef, useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormTextInput } from '@shared/ui/forms/FormTextInput'
import { PrimaryButton } from '@shared/ui/buttons/PrimaryButton'
import { styles } from './login.styles'

// Cuando activemos backend real, movemos el schema a model/
const LoginSchema = z.object({
  email: z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type LoginForm = z.infer<typeof LoginSchema>

// import { loginUseCase } from '../application/usecases' // real
// import { setSessionTokens } from '@shared/session/session'
// import { configureHttp } from '@shared/api/http' // para inyectar tokens/refresh

export function LoginScreen() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  })

  // refs para “siguiente campo”
  const pwdRef = useRef<any>(null)

  const onSubmit = useCallback(
    async (data: LoginForm) => {
      if (submitting) return
      setSubmitting(true)
      setSubmitError(null)
      try {
        // Lógica real comentada por ahora
        // const tokens = await loginUseCase(data.email, data.password)
        // await setSessionTokens(tokens)
        // configureHttp({
        //   getAccessToken: () => tokens.accessToken,
        //   refreshToken: async () => {
        //     const refreshed = await refreshSessionTokens()
        //     return refreshed?.accessToken
        //   },
        // })

        // Navegación temporal mientras el login real está desactivado
        router.replace('/(app)/selector')
      } catch (e) {
        setSubmitError('Credenciales inválidas o error de red.')
      } finally {
        setSubmitting(false)
      }
    },
    [router, submitting],
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.title}>KMA_app</Text>
        <Text style={styles.subtitle}>Ingresá con tu cuenta</Text>

        <FormTextInput
          control={control}
          name="email"
          label="Email"
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => pwdRef.current?.focus?.()}
        />

        <FormTextInput
          control={control}
          name="password"
          label="Contraseña"
          placeholder="••••••••"
          secureTextEntry
          textContentType="password"
          ref={pwdRef}
          returnKeyType="done"
          onSubmitEditing={handleSubmit(onSubmit)}
        />

        <PrimaryButton
          label={submitting ? 'Ingresando…' : 'Ingresar'}
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid || submitting}
          style={styles.primaryButton}
        />

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
      </View>

      <Text style={styles.footerText}>v1.0.0</Text>
    </KeyboardAvoidingView>
  )
}
