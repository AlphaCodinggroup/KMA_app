import React, { useMemo } from 'react'
import { View, type ImageSourcePropType } from 'react-native'
import { styles } from './styles/stepIllustration.styles'
import ZoomableImage from '@shared/ui/ZoomableImage/ZoomableImage'

type Props = {
  image?: string
  onZoomChange: (z: boolean) => void
}

const StepIllustration: React.FC<Props> = ({ image, onZoomChange }) => {
  const source: ImageSourcePropType | undefined = useMemo(() => {
    if (!image) return undefined
    return { uri: image }
  }, [image])

  if (!source) return null

  return (
    <View style={styles.wrapper} accessibilityIgnoresInvertColors>
      <ZoomableImage source={source} onZoomChange={onZoomChange} />
    </View>
  )
}

export default StepIllustration
