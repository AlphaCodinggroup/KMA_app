import { useCallback, useRef, useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormTextInput } from '@shared/ui/forms/FormTextInput'
import { styles } from './login.styles'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import { loginUseCase } from '@features/auth/application/usecases'
import { saveSession } from '@shared/session/session'
import { normalizeAuthError } from '../lib/utils'

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

const LoginScreen: React.FC = () => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const pwdRef = useRef(null)

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    mode: 'onChange',
    defaultValues: { username: '', password: '' },
  })

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
          size="sm"
          style={styles.primaryButton}
        />

        {submitError && <Text style={styles.errorText}>{submitError}</Text>}
      </View>

      <Text style={styles.footerText}>v1.0.0</Text>
    </KeyboardAvoidingView>
  )
}

export default LoginScreen
