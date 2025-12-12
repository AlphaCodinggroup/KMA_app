import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { setResponsiveSize } from '../responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  headerBlock: { paddingHorizontal: RFValue(16), paddingVertical: RFValue(12) },
  errorText: {
    color: AppColors.Error,
    textAlign: 'center',
    marginTop: RFValue(16),
    paddingHorizontal: RFValue(16),
    fontSize: setResponsiveSize({ size: 12 }),
  },
})
