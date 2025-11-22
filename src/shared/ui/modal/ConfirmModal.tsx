import React, { memo } from 'react'
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'
import { styles } from './confirmModal.styles'

export interface ConfirmModalProps {
  visible: boolean
  title?: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
  dismissOnBackdropPress?: boolean
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  dismissOnBackdropPress = true,
}) => {
  const handleBackdropPress = () => {
    if (dismissOnBackdropPress) onCancel()
  }

  const confirmColor = destructive ? AppColors.Error : AppColors.Primary

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        {/* Fondo clickeable */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />

        <View style={styles.container} accessible accessibilityRole="alert">
          {title ? <Text style={styles.title}>{title}</Text> : null}

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={styles.button}
            >
              <Text style={[styles.buttonText, { color: confirmColor }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default memo(ConfirmModal)
