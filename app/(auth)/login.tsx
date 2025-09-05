import React, { useCallback, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
// import { setSessionTokens } from '@shared/session/session';
// import { configureHttp } from '@shared/api/http';

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)

  //!NOTA: Descomentar la lógica real cuando habilitemos auth.
  const onSubmit = useCallback(async () => {
    setLoading(true)
    try {
      // (LOGIN REAL COMENTADO)
      // const tokens = await AuthService.login({ email, password: pwd });
      // await setSessionTokens(tokens);
      // configureHttp({ tokenRefresher: AuthService.refresh });
      // router.replace('/(app)/selector');

      // NAVEGACIÓN DIRECTA A SELECTOR (mientras login está desactivado)
      router.replace('/(app)/selector')
    } catch {
      // TODO: mostrar error de credenciales
    } finally {
      setLoading(false)
    }
  }, [router])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KMA_app</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={pwd}
        onChangeText={setPwd}
      />
      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : 'Ingresar'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
})
