import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

const AppLayout: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: AppColors.Background },
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </SafeAreaView>
  )
}

export default AppLayout

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
})
