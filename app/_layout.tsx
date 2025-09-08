import { Stack } from 'expo-router'
import { AuthGuard } from '@processes/auth-guard'

const RootLayout: React.FC = () => {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthGuard>
  )
}

export default RootLayout
