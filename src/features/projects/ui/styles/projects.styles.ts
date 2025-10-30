import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  headerBlock: { paddingHorizontal: RFValue(16), paddingTop: RFValue(12) },
  h1: {
    fontSize: setResponsiveSize({ size: 22 }),
    fontWeight: 'bold',
    color: AppColors.TextPrimary,
    marginBottom: RFValue(6),
  },
})
