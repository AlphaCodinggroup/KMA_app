import { memo } from 'react'
import { View, Text, Image, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { AppColors } from '@shared/ui/colors'
import { styles } from './photoFields.styles'

type Props = {
  label: string
  value: string[] // siempre normalizado a string[]
  onAdd: () => Promise<string | null> | void
  onRemoveAt: (index: number) => void
  addButtonText?: string
  removeButtonText?: string
  testID?: string
  disabled?: boolean
}

const isDisplayableUri = (uri?: string | null) =>
  !!uri && /^(file|content|data|asset|https?):/i.test(uri)

const PhotoFieldBase: React.FC<Props> = ({
  label,
  value,
  onAdd,
  onRemoveAt,
  addButtonText = 'Add another photo',
  removeButtonText = 'Remove',
  testID,
  disabled = false,
}) => {
  const handleAdd = async () => {
    if (disabled) return
    try {
      const uri = await onAdd()
      // El agregado real lo decide el padre (DynamicForm) usando setValue
      return uri
    } catch {
      Alert.alert('Foto', 'The image could not be obtained.')
    }
  }

  const hasPhotos = Array.isArray(value) && value.length > 0

  return (
    <View style={styles.inputBlock} testID={testID}>
      <Text style={styles.label}>{label}</Text>

      {hasPhotos && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollview}>
          {value.map((uri, idx) => {
            const previewable = isDisplayableUri(uri)
            return (
              <View key={`${uri}-${idx}`} style={styles.containerImage}>
                {previewable ? (
                  <Image source={{ uri }} style={styles.photoThumb} />
                ) : (
                  <View style={styles.photoThumb}>
                    <Text style={{ color: AppColors.MutedText }}>Selected image</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => onRemoveAt(idx)}
                  style={styles.smallBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${idx + 1}`}
                  disabled={disabled}
                  hitSlop={8}
                >
                  <Text style={styles.smallBtnText}>{removeButtonText}</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        onPress={handleAdd}
        style={[styles.button, styles.secondaryBtn]}
        accessibilityRole="button"
        accessibilityLabel={hasPhotos ? 'Add another photo' : 'Upload photo'}
        disabled={disabled}
      >
        <Text style={styles.btnText}>{hasPhotos ? addButtonText : 'Upload photo'}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default memo(PhotoFieldBase)
