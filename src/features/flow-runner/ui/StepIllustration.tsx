import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { styles } from './styles/stepIllustration.styles'
import ZoomableImage from '@shared/ui/ZoomableImage/ZoomableImage'
import { resolveFlowImageUri } from '@shared/lib/imageCache'
import { resolveStepImageUrls } from '@shared/lib/flowStepImages'

type Props = {
  image?: string
  images?: string[]
  onZoomChange: (z: boolean) => void
}

const StepIllustration: React.FC<Props> = ({ image, images, onZoomChange }) => {
  const preferredImages = useMemo(
    () =>
      resolveStepImageUrls({
        ...(typeof image === 'string' ? { image } : {}),
        ...(Array.isArray(images) ? { images } : {}),
      }),
    [image, images],
  )
  const [resolvedUris, setResolvedUris] = useState<string[]>(preferredImages)

  useEffect(() => {
    let cancelled = false

    if (preferredImages.length === 0) {
      setResolvedUris([])
      return
    }

    // Comportamiento optimista: primero usamos las URLs remotas
    setResolvedUris(preferredImages)
    ;(async () => {
      const uris = await Promise.all(
        preferredImages.map(async currentImage => {
          try {
            return (await resolveFlowImageUri(currentImage)) ?? currentImage
          } catch (e) {
            if (__DEV__) {
              console.warn('[StepIllustration] resolveFlowImageUri failed', e)
            }
            return currentImage
          }
        }),
      )

      if (!cancelled) {
        setResolvedUris(uris)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [preferredImages])

  if (resolvedUris.length === 0) return null

  return (
    <View style={styles.wrapper} accessibilityIgnoresInvertColors>
      {resolvedUris.map((uri, index) => (
        <ZoomableImage
          key={`${uri}-${index}`}
          source={{ uri }}
          onZoomChange={onZoomChange}
          style={index < resolvedUris.length - 1 ? styles.imageSpacing : undefined}
        />
      ))}
    </View>
  )
}

export default StepIllustration
