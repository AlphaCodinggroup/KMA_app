import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Background,
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(20),
  },
  card: {
    backgroundColor: AppColors.SurfaceAlt,
    borderRadius: RFValue(12),
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    marginBottom: RFValue(16),
  },
  label: {
    fontSize: setResponsiveSize({ size: 12 }),
    color: AppColors.MutedText,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  sectionSpacing: {
    marginTop: RFValue(12),
  },
  value: {
    fontSize: setResponsiveSize({ size: 16 }),
    color: AppColors.TextPrimary,
    fontWeight: '600',
    marginTop: RFValue(4),
  },
  error: {
    color: AppColors.Error,
    marginBottom: RFValue(12),
    fontSize: RFValue(13),
  },
  button: {
    marginTop: RFValue(8),
  },
})
