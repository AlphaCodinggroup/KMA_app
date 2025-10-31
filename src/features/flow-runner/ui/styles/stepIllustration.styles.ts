import { StyleSheet } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'

export const styles = StyleSheet.create({
  wrapper: {
    marginBottom: RFValue(16),
    borderRadius: RFValue(12),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
