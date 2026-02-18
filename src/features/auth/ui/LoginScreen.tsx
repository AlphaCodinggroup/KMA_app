import React from 'react'
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native'
import { FormTextInput } from '@shared/ui/forms/FormTextInput'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import Loader from '@shared/ui/loader/Loader'
import { styles } from './login.styles'
import { useLogin } from '@features/auth/application/useLogin'

const LoginScreen: React.FC = () => {
  const {
    control,
    handleSubmit,
    formState,
    passwordRef,
    submitting,
    submitError,
    checkingSession,
    onSubmit,
  } = useLogin()

  // Si estamos chequeando sesión (refreshToken + getValidToken),
  // no mostramos el formulario para evitar el “flicker” del login.
  if (checkingSession) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <Loader loading text="Checking your session..." />
      </KeyboardAvoidingView>
    )
  }

  const { isValid } = formState

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
          onSubmitEditing={() => passwordRef.current?.focus?.()}
        />

        <FormTextInput
          control={control}
          name="password"
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          textContentType="password"
          ref={passwordRef}
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

      <Text style={styles.footerText}>v1.0.6</Text>
    </KeyboardAvoidingView>
  )
}

export default LoginScreen
