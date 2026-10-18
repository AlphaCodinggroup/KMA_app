import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.SurfaceAlt,
    borderRadius: RFValue(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(12),
    marginBottom: RFValue(16),
    gap: RFValue(8),
  },
  heading: { fontSize: RFValue(14), fontWeight: '700', color: AppColors.TextPrimary },
  summary: { fontSize: RFValue(12), color: AppColors.MutedText },
  banner: {
    backgroundColor: AppColors.InfoLight,
    borderRadius: RFValue(8),
    paddingHorizontal: RFValue(10),
    paddingVertical: RFValue(6),
  },
  bannerText: { fontSize: RFValue(12), color: AppColors.TextPrimary },
  warning: {
    backgroundColor: AppColors.ErrorLight,
    borderRadius: RFValue(8),
    paddingHorizontal: RFValue(10),
    paddingVertical: RFValue(6),
  },
  warningText: { fontSize: RFValue(12), color: AppColors.Error },
  row: { flexDirection: 'row', alignItems: 'center', gap: RFValue(8) },
  rowTitle: { flex: 1, fontSize: RFValue(13), color: AppColors.TextPrimary },
  rowCount: { fontSize: RFValue(12), color: AppColors.MutedText },
  button: { marginTop: RFValue(4) },
})
