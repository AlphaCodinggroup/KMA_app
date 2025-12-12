import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { paddingHorizontal: RFValue(16) },
  label: {
    fontSize: setResponsiveSize({ size: 12 }),
    fontWeight: 'bold',
    marginBottom: RFValue(8),
    color: AppColors.TextPrimary,
  },
  lettersRow: { gap: RFValue(12), paddingRight: RFValue(8) },
  chip: {
    borderRadius: RFValue(16),
    paddingHorizontal: RFValue(14),
    paddingVertical: RFValue(8),
  },
  chipInactive: { backgroundColor: AppColors.Border },
  chipActive: { backgroundColor: AppColors.Primary },
  chipPressed: { opacity: 0.5 },
  chipText: { fontSize: setResponsiveSize({ size: 12 }), fontWeight: 'bold' },
  chipTextInactive: { color: AppColors.TextPrimary },
  chipTextActive: { color: AppColors.SurfaceAlt },
})
