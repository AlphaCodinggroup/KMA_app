import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  listContent: { paddingHorizontal: RFValue(12), paddingBottom: RFValue(24) },
  headline: { paddingHorizontal: RFValue(12), paddingTop: RFValue(16), paddingBottom: RFValue(8) },
  empty: {
    flex: 1,
    backgroundColor: AppColors.Background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: RFValue(24),
  },
  emptyText: {
    fontSize: RFValue(16),
    color: AppColors.TextPrimary,
    textAlign: 'center',
    marginBottom: RFValue(16),
  },
  emptyButton: { minWidth: RFValue(160), justifyContent: 'center' },
  card: {
    backgroundColor: AppColors.Background,
    borderWidth: 1,
    borderColor: AppColors.Border,
    borderRadius: RFValue(12),
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(12),
  },
  title: { fontSize: RFValue(15), fontWeight: '600', color: AppColors.TextPrimary },
  meta: { fontSize: RFValue(12), color: AppColors.MutedText, marginTop: RFValue(4) },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: RFValue(10),
  },
  badge: {
    paddingHorizontal: RFValue(10),
    paddingVertical: RFValue(4),
    borderRadius: RFValue(999),
  },
  badgeSuccess: {
    backgroundColor: AppColors.SuccessLight,
    borderWidth: 1,
    borderColor: AppColors.SuccessBorder,
  },
  badgeInfo: {
    backgroundColor: AppColors.InfoLight,
    borderWidth: 1,
    borderColor: AppColors.InfoBorder,
  },
  badgeWarning: {
    backgroundColor: AppColors.WarningLight,
    borderWidth: 1,
    borderColor: AppColors.WarningBorder,
  },
  badgeError: {
    backgroundColor: AppColors.ErrorLight,
    borderWidth: 1,
    borderColor: AppColors.ErrorBorder,
  },
  badgeNeutral: {
    backgroundColor: AppColors.SurfaceAlt,
    borderWidth: 1,
    borderColor: AppColors.Border,
  },
  badgeText: { fontSize: RFValue(12), fontWeight: '600' },
  badgeTextSuccess: { color: AppColors.SuccessText },
  badgeTextInfo: { color: AppColors.InfoText },
  badgeTextWarning: { color: AppColors.WarningText },
  badgeTextError: { color: AppColors.Error },
  badgeTextNeutral: { color: AppColors.MutedText },
  editButton: { minWidth: RFValue(120) },
})
