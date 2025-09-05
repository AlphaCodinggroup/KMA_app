import { AppColors } from '@shared/ui/colors'
import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: AppColors.Background },
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    />
  )
}
