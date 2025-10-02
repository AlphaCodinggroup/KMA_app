import { Dimensions } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import { DeviceType } from 'expo-device'

export type ResponsiveSize = {
  size?: number
  tablet?: number
  small?: number
  phone?: number
}

const isSmallDevice = Dimensions.get('window').width < 375

export const setResponsiveSize = ({ size, phone, small, tablet }: ResponsiveSize) => {
  return isSmallDevice
    ? RFValue(small || size || 17)
    : DeviceType.TABLET
      ? RFValue(tablet || size || 10)
      : RFValue(phone || size || 12)
}
