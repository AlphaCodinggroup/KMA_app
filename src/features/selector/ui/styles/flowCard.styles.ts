import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600', color: AppColors.Primary },
  description: { marginTop: 6, color: AppColors.MutedText },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: { fontSize: 12, color: AppColors.MutedText },
})
