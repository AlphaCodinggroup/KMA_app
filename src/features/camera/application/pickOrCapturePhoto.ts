import { Alert, Platform, ActionSheetIOS } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

type Source = 'camera' | 'library'

function askSource(): Promise<Source | null> {
  return new Promise(resolve => {
    const onCamera = () => resolve('camera')
    const onLibrary = () => resolve('library')
    const onCancel = () => resolve(null)

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Choose source',
          options: ['Camera', 'Photo Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        btnIndex => {
          if (btnIndex === 0) onCamera()
          else if (btnIndex === 1) onLibrary()
          else onCancel()
        },
      )
    } else {
      Alert.alert('Photo', 'Select source', [
        { text: 'Camera', onPress: onCamera },
        { text: 'Photo Library', onPress: onLibrary },
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
      ])
    }
  })
}

export async function pickOrCapturePhoto(): Promise<string | null> {
  const choice = await askSource()
  if (!choice) return null

  try {
    if (choice === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission', 'Camera permission denied.')
        return null
      }
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      })
      return shot.canceled ? null : (shot.assets?.[0]?.uri ?? null)
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission', 'Photo library permission denied.')
        return null
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      })
      return pick.canceled ? null : (pick.assets?.[0]?.uri ?? null)
    }
  } catch (e) {
    Alert.alert('Photo error', 'Could not get image.')
    return null
  }
}
