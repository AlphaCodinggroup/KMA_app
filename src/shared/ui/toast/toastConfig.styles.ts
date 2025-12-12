import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { setResponsiveSize } from '../responsive/setResponsiveSize'
import { AppColors } from '../colors'

export const styles = StyleSheet.create({
  base: {
    borderLeftWidth: 0,
    borderRadius: RFValue(12),
    marginHorizontal: RFValue(12),
    marginTop: RFValue(8),
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  content: {
    paddingHorizontal: RFValue(12),
    paddingVertical: RFValue(8),
  },
  text1: {
    fontSize: setResponsiveSize({ size: 14 }),
    fontWeight: 'bold',
  },
  text2: {
    fontSize: setResponsiveSize({ size: 13 }),
    marginTop: RFValue(2),
  },
  success: { backgroundColor: AppColors.SuccessLight },
  info: { backgroundColor: AppColors.InfoLight },
  error: { backgroundColor: AppColors.ErrorLight },
  textError: { color: AppColors.Error },
})
