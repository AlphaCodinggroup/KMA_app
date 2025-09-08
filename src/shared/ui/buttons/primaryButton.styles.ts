import { StyleSheet } from 'react-native'
import { AppColors } from '../colors'

export const styles = StyleSheet.create({
  button: {
    backgroundColor: AppColors.Primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  text: { color: AppColors.Background, fontWeight: 'bold' },
  disabled: { opacity: 0.6 },
})
