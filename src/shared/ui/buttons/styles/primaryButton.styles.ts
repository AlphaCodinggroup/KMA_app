import { AppColors } from '@shared/ui/colors'
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export type ButtonVariant = 'primary' | 'outline' | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg'

export const HEIGHTS: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 52,
}

export const FONTS: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 17,
}

export const H_PADDING: Record<ButtonSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
}

export const styles = StyleSheet.create({
  base: {
    borderRadius: RFValue(12),
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.5 },
  label: { fontWeight: 'bold', textAlign: 'center' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  iconSlot: {
    width: RFValue(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: { width: RFValue(22) },
  fullWidth: { alignSelf: 'stretch' },
})

/** Contenedor por variante */
export function getVariantContainerStyle(variant: ButtonVariant): ViewStyle {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: AppColors.Primary,
        borderColor: AppColors.Primary,
      }
    case 'outline':
      return {
        backgroundColor: AppColors.Background,
        borderColor: AppColors.Border,
      }
    case 'danger':
      return {
        backgroundColor: AppColors.Error,
        borderColor: AppColors.Error,
      }
    default:
      return {
        backgroundColor: AppColors.Primary,
        borderColor: AppColors.Primary,
      }
  }
}

/** Texto por variante */
export function getVariantLabelStyle(variant: ButtonVariant): TextStyle {
  switch (variant) {
    case 'primary':
    case 'danger':
      return { color: AppColors.Background }
    case 'outline':
      return { color: AppColors.TextPrimary }
    default:
      return { color: AppColors.Background }
  }
}
