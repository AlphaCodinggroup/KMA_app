import { StyleSheet } from 'react-native'
import { AppColors } from '../colors'

export const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { marginBottom: 6, color: AppColors.Primary, fontWeight: 'bold' },
  input: {
    borderWidth: 1,
    borderColor: AppColors.Border,
    borderRadius: 8,
    padding: 12,
  },
  inputError: { borderColor: AppColors.Error },
  error: { marginTop: 6, color: AppColors.Error },
})
