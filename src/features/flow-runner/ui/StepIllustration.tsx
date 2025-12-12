import React, { useEffect, useMemo, useState } from 'react'
import { View, type ImageSourcePropType } from 'react-native'
import { styles } from './styles/stepIllustration.styles'
import ZoomableImage from '@shared/ui/ZoomableImage/ZoomableImage'
import { resolveFlowImageUri } from '@shared/lib/imageCache'

type Props = {
  image?: string
  onZoomChange: (z: boolean) => void
}

const StepIllustration: React.FC<Props> = ({ image, onZoomChange }) => {
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(image)

  useEffect(() => {
    let cancelled = false

    if (!image) {
      setResolvedUri(undefined)
      return
    }

    // Comportamiento optimista: primero usamos la URL remota
    setResolvedUri(image)
    ;(async () => {
      try {
        const uri = await resolveFlowImageUri(image)
        if (!cancelled) {
          setResolvedUri(uri)
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[StepIllustration] resolveFlowImageUri failed', e)
        }
        // Si falla, quedamos con la URL remota, sin romper nada.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [image])

  const source: ImageSourcePropType | undefined = useMemo(() => {
    if (!resolvedUri) return undefined
    return { uri: resolvedUri }
  }, [resolvedUri])

  if (!source) return null

  return (
    <View style={styles.wrapper} accessibilityIgnoresInvertColors>
      <ZoomableImage source={source} onZoomChange={onZoomChange} />
    </View>
  )
}

export default StepIllustration
