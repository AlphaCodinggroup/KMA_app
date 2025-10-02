import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

const RADIUS = RFValue(12)
const P = RFValue(12)

export const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    backgroundColor: AppColors.Background,
    overflow: 'hidden',
  },
  cardSelected: { borderColor: AppColors.Primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: P,
    paddingVertical: P,
    gap: 12,
    backgroundColor: AppColors.SurfaceAlt,
  },
  pressed: { opacity: 0.5 },
  left: {
    width: RFValue(36),
    height: RFValue(36),
    borderRadius: RFValue(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.SurfaceAlt,
  },
  center: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: AppColors.TextPrimary,
    fontSize: setResponsiveSize({ size: 14 }),
    fontWeight: 'bold',
  },
  subtitle: {
    color: AppColors.MutedText,
    fontSize: setResponsiveSize({ size: 13 }),
  },
  description: {
    color: AppColors.MutedText,
    fontSize: setResponsiveSize({ size: 12 }),
    marginTop: RFValue(2),
  },
  right: {
    marginLeft: RFValue(8),
    minWidth: RFValue(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontSize: setResponsiveSize({ size: 10 }), color: AppColors.MutedText },
})
