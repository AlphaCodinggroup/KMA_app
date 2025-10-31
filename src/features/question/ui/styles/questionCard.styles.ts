import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { gap: RFValue(16), padding: RFValue(16) },
  question: {
    fontSize: setResponsiveSize({ size: 14 }),
    fontWeight: 'bold',
    color: AppColors.Primary,
  },
  optionsBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionItem: {
    padding: RFValue(12),
    backgroundColor: AppColors.Background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.Border,
  },
  optionItemSelected: { backgroundColor: AppColors.SurfaceAlt },
  optionText: { color: AppColors.Primary, fontSize: setResponsiveSize({ size: 10 }) },
  actions: { flexDirection: 'row', gap: RFValue(12), marginTop: RFValue(8) },
  button: {
    flex: 1,
    paddingVertical: RFValue(12),
    borderRadius: RFValue(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnNo: { backgroundColor: AppColors.Border },
  btnPressed: { opacity: 0.5 },
  btnText: {
    fontWeight: 'bold',
    color: AppColors.Primary,
    fontSize: setResponsiveSize({ size: 12 }),
  },
  btnYesText: { color: AppColors.Background },
})
