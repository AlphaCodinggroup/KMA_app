import React, { useCallback, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { Stack, useRouter } from 'expo-router'

import { AppColors } from '@shared/ui/colors'
import Icon from '@shared/ui/icons/Icon'
import AuthGuard from '@processes/auth-guard'
import ConfirmModal from '@shared/ui/modal/ConfirmModal'

const AppLayout: React.FC = () => {
  const router = useRouter()

  const [exitAuditModalVisible, setExitAuditModalVisible] = useState<boolean>(false)

  const openExitModal = useCallback(() => setExitAuditModalVisible(true), [])

  const closeExitModal = useCallback(() => setExitAuditModalVisible(false), [])

  const handleConfirmExitAudit = useCallback(() => {
    setExitAuditModalVisible(false)
    router.back()
  }, [router])

  const BackButton = useCallback(
    () => (
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={{ paddingRight: RFValue(8), paddingLeft: RFValue(4) }}
      >
        <Icon name="chevronLeft" color={AppColors.Primary} size={RFValue(22)} />
      </TouchableOpacity>
    ),
    [router],
  )

  const ConfirmExitBackButton = useCallback(
    () => (
      <TouchableOpacity
        onPress={openExitModal}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Salir de la auditoría"
        style={{ paddingRight: RFValue(8), paddingLeft: RFValue(4) }}
      >
        <Icon name="chevronLeft" color={AppColors.Primary} size={RFValue(22)} />
      </TouchableOpacity>
    ),
    [openExitModal],
  )

  return (
    <AuthGuard>
      <>
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
              headerLeft: ConfirmExitBackButton,
              headerBackVisible: false,
            }}
          />
        </Stack>

        <ConfirmModal
          visible={exitAuditModalVisible}
          title="Do you want to exit the audit?"
          message="If you go back, you will lose all your progress."
          cancelLabel="Stay here"
          confirmLabel="Exit and lose everything"
          onCancel={closeExitModal}
          onConfirm={handleConfirmExitAudit}
          destructive
        />
      </>
    </AuthGuard>
  )
}

export default AppLayout
