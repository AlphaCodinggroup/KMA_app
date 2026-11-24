import { Alert, Platform, ActionSheetIOS } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

import { persistPhoto } from './persistPhoto'

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

/**
 * Pide la foto (cámara o galería) y la persiste en `documentDirectory` bajo `groupId`.
 * Devuelve la URI persistida, nunca la de caché.
 */
export async function pickOrCapturePhoto(groupId: string): Promise<string | null> {
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
        mediaTypes: ['images'],
        quality: 0.8,
      })
      const uri = shot.canceled ? null : (shot.assets?.[0]?.uri ?? null)
      return uri ? (await persistPhoto(uri, groupId)).uri : null
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission', 'Photo library permission denied.')
        return null
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      })
      const uri = pick.canceled ? null : (pick.assets?.[0]?.uri ?? null)
      return uri ? (await persistPhoto(uri, groupId)).uri : null
    }
  } catch {
    Alert.alert('Photo error', 'Could not get image.')
    return null
  }
}
