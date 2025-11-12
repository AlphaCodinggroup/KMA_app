import { StyleSheet } from 'react-native'
import { AppColors } from '@shared/ui/colors'
import { RFValue } from 'react-native-responsive-fontsize'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.Background },
  header: {
    paddingHorizontal: RFValue(16),
    paddingTop: RFValue(12),
    paddingBottom: RFValue(8),
    borderBottomColor: AppColors.Border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: AppColors.Background,
  },
  title: {
    fontSize: setResponsiveSize({ size: 16 }),
    fontWeight: 'bold',
    color: AppColors.Primary,
  },
  subtitle: {
    fontSize: setResponsiveSize({ size: 12 }),
    color: AppColors.MutedText,
    marginTop: RFValue(2),
  },
  content: { padding: RFValue(12) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  containerComponents: { marginBottom: RFValue(16) },
})
