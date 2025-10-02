import { StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'
import { RFValue } from 'react-native-responsive-fontsize'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: RFValue(24),
    justifyContent: 'center',
    backgroundColor: AppColors.Background,
  },
  card: {
    borderWidth: RFValue(1),
    borderColor: AppColors.Border,
    borderRadius: RFValue(12),
    padding: RFValue(16),
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: RFValue(2) },
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: AppColors.Background,
  },
  title: {
    fontSize: setResponsiveSize({ size: 24 }),
    fontWeight: 'bold',
    marginBottom: RFValue(4),
    color: AppColors.Primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: setResponsiveSize({ size: 14 }),
    color: AppColors.MutedText,
    marginBottom: RFValue(16),
    textAlign: 'center',
  },
  errorText: {
    color: AppColors.Error,
    marginTop: RFValue(8),
    textAlign: 'center',
  },
  footerText: {
    textAlign: 'center',
    marginTop: RFValue(16),
    color: AppColors.MutedText,
    fontSize: setResponsiveSize({ size: 12 }),
  },
  primaryButton: { marginTop: RFValue(8) },
})
