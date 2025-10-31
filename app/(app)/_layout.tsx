import { AppColors } from '@shared/ui/colors'
import Icon from '@shared/ui/icons/Icon'
import { Stack, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { Pressable } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import AuthGuard from '@processes/auth-guard'

const AppLayout: React.FC = () => {
  const router = useRouter()

  const BackButton = useCallback(
    () => (
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ paddingRight: RFValue(8), paddingLeft: RFValue(4) }}
      >
        <Icon name="chevronLeft" color={AppColors.Primary} size={RFValue(22)} />
      </Pressable>
    ),
    [router],
  )

  return (
    <AuthGuard>
      <Stack
        screenOptions={{
          headerShown: true,
          gestureEnabled: true,
          headerStyle: { backgroundColor: AppColors.Background },
          headerTitleStyle: { fontWeight: 'bold', fontSize: RFValue(16) },
        }}
      >
        <Stack.Screen
          name="projects"
          options={{ title: 'Select Project', headerBackVisible: false }}
        />
        <Stack.Screen
          name="facilities"
          options={{
            title: 'Select Facility',
            headerLeft: BackButton,
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="selector"
          options={{
            title: 'Select Flow',
            headerLeft: BackButton,
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="flow/[flowId]"
          options={{
            title: 'Audit',
            headerLeft: BackButton,
            headerBackVisible: false,
          }}
        />
      </Stack>
    </AuthGuard>
  )
}

export default AppLayout
