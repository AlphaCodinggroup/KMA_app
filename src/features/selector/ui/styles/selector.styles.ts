import { StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.Background,
  },
  text: { paddingHorizontal: 16, paddingVertical: 16 },
})
