import { Stack } from 'expo-router'
import { AuthGuard } from '@processes/auth-guard'

export default function RootLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthGuard>
  )
}
