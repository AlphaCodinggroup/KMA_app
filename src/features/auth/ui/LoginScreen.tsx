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
  username: z
    .string()
    .min(1, 'The user is mandatory.')
    .min(3, 'Minimum 3 characters.')
    .max(30, 'Maximum 30 characters.'),
  password: z.string().min(6, 'Minimum 6 characters.'),
})
type LoginForm = z.infer<typeof LoginSchema>

// import { loginUseCase } from '../application/usecases' // real
// import { setSessionTokens } from '@shared/session/session'
// import { configureHttp } from '@shared/api/http' // para inyectar tokens/refresh

const LoginScreen: React.FC = () => {
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
    defaultValues: { username: '', password: '' },
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
        setSubmitError('Invalid credentials or network error.')
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
        <Text style={styles.title}>KMA App</Text>
        <Text style={styles.subtitle}>Log in with your account</Text>

        <FormTextInput
          control={control}
          name="username"
          label="User"
          placeholder="your-username"
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => pwdRef.current?.focus?.()}
        />

        <FormTextInput
          control={control}
          name="password"
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          textContentType="password"
          ref={pwdRef}
          returnKeyType="done"
          onSubmitEditing={handleSubmit(onSubmit)}
        />

        <PrimaryButton
          label={submitting ? 'Logging in...' : 'Log In'}
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

export default LoginScreen
