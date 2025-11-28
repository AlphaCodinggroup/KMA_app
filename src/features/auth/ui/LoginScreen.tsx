import { useCallback, useRef } from 'react'
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormTextInput } from '@shared/ui/forms/FormTextInput'
import { styles } from './login.styles'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import { useLogin } from '@features/auth/application/useLogin'

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

  const { submitting, error, login } = useLogin()

  const onSubmit = useCallback(
    async (data: LoginForm) => {
      const ok = await login(data.username, data.password)
      if (ok) {
        router.replace('/(app)/projects')
      }
    },
    [login, router],
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
          placeholder="Your username"
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

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <Text style={styles.footerText}>v1.0.3</Text>
    </KeyboardAvoidingView>
  )
}

export default LoginScreen
