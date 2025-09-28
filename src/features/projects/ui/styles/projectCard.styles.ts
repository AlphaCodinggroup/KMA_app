import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.Border,
    backgroundColor: AppColors.Background,
  },
  cardPressed: { opacity: 0.92 },
  leftIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: AppColors.Border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: AppColors.Primary,
  },
})
