import { StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: AppColors.Background,
  },
  card: {
    borderWidth: 1,
    borderColor: AppColors.Border,
    borderRadius: 12,
    padding: 16,
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: AppColors.Background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: AppColors.Primary,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.MutedText,
    marginBottom: 16,
  },
  errorText: {
    color: AppColors.Error,
    marginTop: 8,
    textAlign: 'center',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 16,
    color: AppColors.MutedText,
  },
  primaryButton: {
    marginTop: 8,
  },
})
