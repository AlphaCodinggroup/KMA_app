import 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { AuthGuard } from '@processes/auth-guard'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const RootLayout: React.FC = () => {
  return (
    <GestureHandlerRootView>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthGuard>
    </GestureHandlerRootView>
  )
}

export default RootLayout
