import React, { memo } from 'react'
import {
  ActivityIndicator,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  TouchableOpacity,
} from 'react-native'
import {
  type ButtonSize,
  type ButtonVariant,
  FONTS,
  getVariantContainerStyle,
  getVariantLabelStyle,
  H_PADDING,
  HEIGHTS,
  styles,
} from './styles/primaryButton.styles'
import { RFValue } from 'react-native-responsive-fontsize'
import { setResponsiveSize } from '../responsive/setResponsiveSize'

export interface PrimaryButtonProps {
  label?: string
  children?: React.ReactNode
  onPress?: (event: GestureResponderEvent) => void
  disabled?: boolean
  loading?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
  testID?: string
  accessibilityLabel?: string
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  contentStyle,
  labelStyle,
  testID,
  accessibilityLabel,
}) => {
  return (
    <View style={[fullWidth && styles.fullWidth, style]}>
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.base,
          (disabled || loading) && styles.disabled,
          getVariantContainerStyle(variant),
          {
            height: RFValue(HEIGHTS[size]),
            paddingHorizontal: RFValue(H_PADDING[size]),
          },
          contentStyle,
        ]}
      >
        {/* left icon */}
        {leftIcon ? (
          <View style={styles.iconSlot}>{leftIcon}</View>
        ) : (
          <View style={styles.iconSpacer} />
        )}

        {/* label / custom content */}
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator />
          ) : children ? (
            children
          ) : (
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                getVariantLabelStyle(variant),
                { fontSize: setResponsiveSize({ size: FONTS[size] }) },
                labelStyle,
              ]}
            >
              {label}
            </Text>
          )}
        </View>

        {/* right icon */}
        {rightIcon ? (
          <View style={styles.iconSlot}>{rightIcon}</View>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </TouchableOpacity>
    </View>
  )
}

export default memo(PrimaryButton)
