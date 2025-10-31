import { StyleSheet } from 'react-native'
import { AppColors } from '../colors'
import { RFValue } from 'react-native-responsive-fontsize'
import { setResponsiveSize } from '../responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  wrapper: { marginBottom: RFValue(12) },
  label: {
    marginBottom: RFValue(6),
    color: AppColors.Primary,
    fontWeight: 'bold',
    fontSize: setResponsiveSize({ size: 12 }),
  },
  input: {
    borderWidth: RFValue(1),
    borderColor: AppColors.Border,
    borderRadius: RFValue(8),
    padding: RFValue(12),
    fontSize: setResponsiveSize({ size: 12 }),
  },
  inputError: { borderColor: AppColors.Error, fontSize: setResponsiveSize({ size: 10 }) },
  error: {
    marginTop: RFValue(6),
    color: AppColors.Error,
    fontSize: setResponsiveSize({ size: 10 }),
  },
})
