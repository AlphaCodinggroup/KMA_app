import 'react-native-gesture-handler'
import 'expo-router/entry'
import { Redirect } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const Index: React.FC = () => {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <Redirect href="/(auth)/login" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
export default Index
