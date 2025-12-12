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
  inputContainer: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: RFValue(1),
    borderColor: AppColors.Border,
    borderRadius: RFValue(8),
    padding: RFValue(12),
    fontSize: setResponsiveSize({ size: 12 }),
  },
  inputWithToggle: { paddingRight: RFValue(48) },

  inputError: { borderColor: AppColors.Error, fontSize: setResponsiveSize({ size: 10 }) },
  error: {
    marginTop: RFValue(6),
    color: AppColors.Error,
    fontSize: setResponsiveSize({ size: 10 }),
  },
  toggleBtn: {
    position: 'absolute',
    right: RFValue(12),
    height: '100%',
    justifyContent: 'center',
  },
  toggleText: {
    color: AppColors.Primary,
    fontSize: setResponsiveSize({ size: 12 }),
    fontWeight: '600',
  },
})
