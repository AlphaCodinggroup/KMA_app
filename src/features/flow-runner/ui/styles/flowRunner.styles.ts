import { StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.Background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomColor: AppColors.Border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: AppColors.Background,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: AppColors.Primary },
  subtitle: { fontSize: 12, color: AppColors.MutedText, marginTop: 2 },
  content: { padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
