import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle } from 'react-native'
import { styles } from './primaryButton.styles'

type Props = {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}

export function PrimaryButton({ label, onPress, disabled, loading, style }: Props) {
  const isDisabled = disabled || loading
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, isDisabled && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      {loading ? <ActivityIndicator /> : <Text style={styles.text}>{label}</Text>}
    </TouchableOpacity>
  )
}
