import { StyleSheet } from 'react-native'

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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  iconSlot: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: {
    width: 22,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
})
