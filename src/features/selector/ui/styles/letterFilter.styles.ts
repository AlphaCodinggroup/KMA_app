import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: AppColors.TextPrimary },
  lettersRow: { gap: 12, paddingRight: 8 },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipInactive: { backgroundColor: AppColors.Border },
  chipActive: { backgroundColor: AppColors.Primary },
  chipPressed: { opacity: 0.85 },
  chipText: { fontSize: 16, fontWeight: 'bold' },
  chipTextInactive: { color: AppColors.TextPrimary },
  chipTextActive: { color: AppColors.SurfaceAlt },
})
