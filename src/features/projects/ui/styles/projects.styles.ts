import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  headerBlock: { paddingHorizontal: RFValue(16), paddingVertical: RFValue(12) },
})
