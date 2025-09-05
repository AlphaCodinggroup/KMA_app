import 'react-native-gesture-handler'
import 'expo-router/entry'
import { Redirect } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function Index() {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <Redirect href="/(auth)/login" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
