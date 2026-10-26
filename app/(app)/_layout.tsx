import React, { useCallback, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router'

import { AppColors } from '@shared/ui/colors'
import Icon from '@shared/ui/icons/Icon'
import AuthGuard from '@processes/auth-guard'
import ConfirmModal from '@shared/ui/modal/ConfirmModal'

const AppLayout: React.FC = () => {
  const router = useRouter()
  const { mode } = useGlobalSearchParams<{ mode?: string }>()
  const isEditing = mode === 'edit'

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

  const ProfileButton = useCallback(
    () => (
      <TouchableOpacity
        onPress={() => router.push('/(app)/profile')}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        style={{ paddingRight: RFValue(8), paddingLeft: RFValue(4), marginRight: RFValue(12) }}
      >
        <Icon name="person" color={AppColors.Primary} size={RFValue(18)} />
      </TouchableOpacity>
    ),
    [router],
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
            options={{
              title: 'Select Project',
              headerBackVisible: false,
              headerRight: ProfileButton,
            }}
          />

          <Stack.Screen
            name="facilities"
            options={{
              title: 'Select Facility',
              headerLeft: BackButton,
              headerBackVisible: false,
              headerRight: ProfileButton,
            }}
          />

          <Stack.Screen
            name="facility/[facilityId]"
            options={{
              title: 'Facility',
              headerLeft: BackButton,
              headerBackVisible: false,
              headerRight: ProfileButton,
            }}
          />

          <Stack.Screen
            name="completed"
            options={{
              title: 'Completed audits',
              headerLeft: BackButton,
              headerBackVisible: false,
              headerRight: ProfileButton,
            }}
          />

          <Stack.Screen
            name="selector"
            options={{
              title: 'Select Flow',
              headerLeft: BackButton,
              headerBackVisible: false,
              headerRight: ProfileButton,
            }}
          />

          <Stack.Screen
            name="profile"
            options={{
              title: 'Profile',
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
          title={isEditing ? 'Discard your changes?' : 'Leave the audit?'}
          message={
            isEditing
              ? 'Your changes have not been saved. If you leave now they will be lost.'
              : 'Your progress is saved. You can resume this audit later.'
          }
          cancelLabel="Stay here"
          confirmLabel={isEditing ? 'Discard' : 'Leave'}
          onCancel={closeExitModal}
          onConfirm={handleConfirmExitAudit}
        />
      </>
    </AuthGuard>
  )
}

export default AppLayout
