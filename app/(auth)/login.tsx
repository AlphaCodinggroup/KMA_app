import React from 'react'
import { SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { AppColors } from '@shared/ui/colors'

export default function LoginScreen() {
  const router = useRouter()

  const handleFakeLogin = () => {
    // Por ahora sin validación: navegamos directo al selector
    router.replace('/(app)/selector')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>KMA_app</Text>
        <Text style={styles.subtitle}>Inicio de sesión (demo)</Text>

        <Pressable
          onPress={handleFakeLogin}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Background,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Divider,
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  title: { fontSize: 28, fontWeight: '800', color: AppColors.Text },
  subtitle: { fontSize: 14, color: AppColors.Subtext },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.Primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: { color: AppColors.Background, fontWeight: '700' },
})
