import { Platform, StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { AppColors } from '../colors'
import { setResponsiveSize } from '../responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: AppColors.Shadow,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: RFValue(24),
  },
  container: {
    width: '100%',
    borderRadius: RFValue(12),
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(18),
    backgroundColor: AppColors.Background,
    ...Platform.select({
      ios: {
        shadowColor: 'black',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  title: {
    fontSize: setResponsiveSize({ size: 16 }),
    fontWeight: 'bold',
    color: AppColors.TextPrimary,
    marginBottom: RFValue(8),
    textAlign: 'center',
  },
  message: {
    fontSize: setResponsiveSize({ size: 14 }),
    color: AppColors.MutedText,
    marginBottom: RFValue(20),
    textAlign: 'center',
  },
  actionsRow: { alignItems: 'center', gap: RFValue(8) },
  button: {
    paddingHorizontal: RFValue(12),
    paddingVertical: RFValue(8),
    borderRadius: RFValue(8),
    minWidth: RFValue(110),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.Border,
    width: '100%',
  },
  buttonText: {
    fontSize: setResponsiveSize({ size: 13 }),
    color: AppColors.TextPrimary,
    fontWeight: '500',
  },
})
