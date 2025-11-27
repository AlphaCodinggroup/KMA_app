import { AppColors } from '@shared/ui/colors'
import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  listContent: { paddingHorizontal: RFValue(12) },
  text: { paddingHorizontal: RFValue(12), paddingTop: RFValue(16), paddingBottom: RFValue(8) },
})
