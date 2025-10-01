import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12 },
  h1: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: 'bold',
    color: AppColors.TextPrimary,
    marginBottom: 6,
  },
})
