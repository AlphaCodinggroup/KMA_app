import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

const RADIUS = 12
const P = 12

export const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    backgroundColor: AppColors.Background,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: AppColors.Primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: P,
    paddingVertical: P,
    gap: 12,
    backgroundColor: AppColors.SurfaceAlt,
  },
  pressed: {
    opacity: 0.96,
  },
  left: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: AppColors.MutedText,
    fontSize: 13,
  },
  description: {
    color: AppColors.MutedText,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  right: {
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontSize: 12, color: AppColors.MutedText },
})
