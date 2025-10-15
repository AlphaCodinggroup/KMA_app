import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  inputBlock: { gap: RFValue(6) },
  label: { color: AppColors.MutedText, fontSize: setResponsiveSize({ size: 12 }) },
  photoThumb: {
    width: RFValue(100),
    height: RFValue(100),
    borderRadius: RFValue(8),
    backgroundColor: AppColors.SurfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    borderRadius: RFValue(8),
    paddingVertical: RFValue(8),
    paddingHorizontal: RFValue(12),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#F9FAFB',
    borderColor: AppColors.Border,
  },
  btnPressed: { opacity: 0.5 },
  smallBtnText: {
    color: AppColors.Primary,
    fontWeight: 'bold',
    fontSize: setResponsiveSize({ size: 12 }),
  },
  button: {
    borderRadius: RFValue(12),
    paddingVertical: RFValue(14),
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtn: { backgroundColor: AppColors.Background, borderColor: AppColors.Border },
  btnText: { color: AppColors.Primary, fontWeight: 'bold' },
  scrollview: { marginVertical: RFValue(8) },
  containerImage: {
    marginRight: RFValue(12),
    borderWidth: RFValue(1),
    borderColor: AppColors.Border,
    borderRadius: RFValue(8),
    overflow: 'hidden',
  },
})
