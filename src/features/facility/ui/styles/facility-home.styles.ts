import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  content: { paddingHorizontal: RFValue(16), paddingTop: RFValue(24) },
  heading: {
    fontSize: RFValue(18),
    fontWeight: '700',
    color: AppColors.TextPrimary,
    marginBottom: RFValue(20),
  },
  secondary: { marginTop: RFValue(12) },
})
