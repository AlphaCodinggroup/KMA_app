import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { gap: RFValue(16), padding: RFValue(10) },
  title: {
    fontSize: setResponsiveSize({ size: 14 }),
    fontWeight: 'bold',
    color: AppColors.Primary,
  },
  formFields: { gap: RFValue(12) },
  inputBlock: { gap: RFValue(6) },
  label: { color: AppColors.MutedText, fontSize: setResponsiveSize({ size: 12 }) },
  textInput: {
    backgroundColor: AppColors.Background,
    borderColor: AppColors.Border,
    borderWidth: RFValue(1),
    borderRadius: RFValue(10),
    paddingHorizontal: RFValue(12),
    paddingVertical: RFValue(10),
    fontSize: setResponsiveSize({ size: 10 }),
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: RFValue(12) },
  button: {
    borderRadius: RFValue(12),
    paddingVertical: RFValue(14),
    alignItems: 'center',
    borderWidth: RFValue(1),
  },
  primaryBtn: { backgroundColor: AppColors.Primary, borderColor: AppColors.Primary },
  primaryBtnText: {
    color: AppColors.Background,
    fontWeight: 'bold',
    fontSize: setResponsiveSize({ size: 12 }),
  },
  secondaryBtn: { backgroundColor: AppColors.Background, borderColor: AppColors.Border },
  btnText: { color: AppColors.Primary, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.5 },
})
