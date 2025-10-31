import { AppColors } from '@shared/ui/colors'
import { setResponsiveSize } from '@shared/ui/responsive/setResponsiveSize'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  content: { gap: RFValue(16) },
  endMessage: { fontSize: setResponsiveSize({ size: 16 }), color: AppColors.Primary },
})
