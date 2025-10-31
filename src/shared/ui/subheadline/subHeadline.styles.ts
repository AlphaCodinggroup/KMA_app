import { StyleSheet } from 'react-native'
import { AppColors } from '../colors'
import { setResponsiveSize } from '../responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  subtitle: {
    fontSize: setResponsiveSize({ size: 14 }),
    fontWeight: '500',
    color: AppColors.MutedText,
  },
})
