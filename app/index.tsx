import 'expo-router/entry'
import { Redirect } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const Index: React.FC = () => {
  return (
    <SafeAreaProvider>
      <Redirect href="/(auth)/login" />
    </SafeAreaProvider>
  )
}
export default Index
