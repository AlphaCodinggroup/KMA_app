import React, { useMemo } from 'react'
import { View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import { flowStepImagesByNumber } from './flowStepImages'
import { styles } from './styles/stepIllustration.styles'
import ZoomableImage from '@shared/ui/ZoomableImage/ZoomableImage'

type Props = {
  stepId: string
  onZoomChange: (z: boolean) => void
}

function extractTwoDigits(id: string): string | null {
  // Extrae la primera secuencia de dígitos del id (Q07, F12, Q8 => 07,12,08)
  const m = id.match(/(\d{1,2})/)
  if (!m) return null
  return m[1].padStart(2, '0')
}

const StepIllustration: React.FC<Props> = ({ stepId, onZoomChange }) => {
  const img: ImageSourcePropType | undefined = useMemo(() => {
    const key = extractTwoDigits(stepId)
    if (!key) return undefined
    return flowStepImagesByNumber[key]
  }, [stepId])

  if (!img) return null

  return (
    <View style={styles.wrapper} accessibilityIgnoresInvertColors>
      <ZoomableImage source={img} onZoomChange={onZoomChange} />
    </View>
  )
}

export default StepIllustration
