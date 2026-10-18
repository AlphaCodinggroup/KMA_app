import { StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.Background,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  itemSeparator: { height: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: RFValue(16),
    paddingBottom: RFValue(8),
    backgroundColor: AppColors.Background,
  },
  sectionBar: {
    width: 4,
    height: RFValue(16),
    borderRadius: 2,
    marginRight: RFValue(8),
    backgroundColor: AppColors.BorderBlue,
  },
  sectionTitle: {
    fontSize: RFValue(13),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: AppColors.TextPrimary,
  },
  text: { paddingHorizontal: RFValue(16), paddingVertical: RFValue(16) },
})
