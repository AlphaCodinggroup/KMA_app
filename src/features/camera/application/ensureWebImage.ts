import * as ImageManipulator from 'expo-image-manipulator'

export type WebImage = { uri: string; type: string; name: string }

export async function ensureWebImage(uri: string): Promise<WebImage> {
  const lower = uri.toLowerCase()
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    })
    return { uri: result.uri, type: 'image/jpeg', name: `photo-${Date.now()}.jpg` }
  }
  const fileName = uri.split('/').pop() ?? `photo-${Date.now()}`
  const isPng = fileName.toLowerCase().endsWith('.png')
  return { uri, type: isPng ? 'image/png' : 'image/jpeg', name: fileName }
}
