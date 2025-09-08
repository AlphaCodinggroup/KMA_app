import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  finishBtnWrapper: {
    borderRadius: 12,
    backgroundColor: AppColors.Primary,
    borderColor: AppColors.Primary,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishBtnText: { color: AppColors.Background, fontWeight: 'bold' },
})
