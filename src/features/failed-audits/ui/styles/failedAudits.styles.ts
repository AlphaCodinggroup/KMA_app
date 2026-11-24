import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  banner: {
    backgroundColor: AppColors.ErrorLight,
    borderRadius: RFValue(12),
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(12),
    marginHorizontal: RFValue(16),
    marginTop: RFValue(8),
  },
  section: {
    marginBottom: RFValue(16),
  },
  heading: {
    fontSize: RFValue(14),
    fontWeight: '700',
    color: AppColors.Error,
  },
  card: {
    backgroundColor: AppColors.ErrorLight,
    borderRadius: RFValue(12),
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(12),
    marginTop: RFValue(8),
  },
  title: {
    fontSize: RFValue(14),
    fontWeight: '600',
    color: AppColors.TextPrimary,
  },
  message: {
    fontSize: RFValue(13),
    color: AppColors.TextPrimary,
    marginTop: RFValue(4),
  },
  button: {
    marginTop: RFValue(10),
  },
})
