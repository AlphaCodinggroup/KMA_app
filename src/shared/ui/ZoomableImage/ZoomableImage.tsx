import React, { useMemo, useState, useCallback, useEffect } from 'react'
import {
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  View,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  clamp,
  runOnJS,
} from 'react-native-reanimated'
import { styles } from './zoomableImage.styles'

type Props = {
  source: ImageSourcePropType
  maxScale?: number
  doubleTapScale?: number
  onZoomChange?: (isZoomed: boolean) => void
  style?: StyleProp<ViewStyle>
}

const AnimatedImage = Animated.createAnimatedComponent(Image)

function getAssetSize(src: ImageSourcePropType): { w: number; h: number } | null {
  // @ts-ignore
  const resolved = Image.resolveAssetSource?.(src)
  if (resolved?.width && resolved?.height) return { w: resolved.width, h: resolved.height }
  return null
}

const ZoomableImage: React.FC<Props> = ({
  source,
  maxScale = 4,
  doubleTapScale = 2,
  onZoomChange,
  style,
}) => {
  // Intentamos obtener tamaño "natural" (assets locales)
  const asset = useMemo(() => getAssetSize(source), [source])

  // Para imágenes remotas / file://, resolvemos w/h asincrónicamente
  const [remoteSize, setRemoteSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const uri: string | undefined = (source as any)?.uri
    if (!uri) {
      setRemoteSize(null)
      return
    }

    let mounted = true
    Image.getSize(
      uri,
      (w, h) => {
        if (mounted) setRemoteSize({ w, h })
      },
      () => {
        if (mounted) setRemoteSize(null)
      },
    )
    return () => {
      mounted = false
    }
  }, [source])

  // Aspect ratio preferido: style.aspectRatio > tamaño remoto > asset > fallback 16/9
  const aspectRatio = useMemo(() => {
    const aspectFromStyle = (style as any)?.aspectRatio
    if (aspectFromStyle) return Number(aspectFromStyle)
    if (remoteSize) return remoteSize.w / remoteSize.h
    if (asset) return asset.w / asset.h
    return 16 / 9
  }, [asset, remoteSize, style])

  // Tamaño efectivo que se dibuja (tras aplicar límite 25% pantalla)
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // SharedValues para worklets (usamos el tamaño efectivo mostrado)
  const boxWsv = useSharedValue(0)
  const boxHsv = useSharedValue(0)
  const contentWsv = useSharedValue(0)
  const contentHsv = useSharedValue(0)

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)

  const notifyZoom = useCallback(
    (val: boolean) => {
      if (onZoomChange) onZoomChange(val)
    },
    [onZoomChange],
  )

  // Si cambia la imagen, reseteamos estado de zoom/posición
  useEffect(() => {
    scale.value = 1
    savedScale.value = 1
    translateX.value = 0
    translateY.value = 0
    startX.value = 0
    startY.value = 0
    runOnJS(notifyZoom)(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: containerW } = e.nativeEvent.layout
    if (!containerW || containerW <= 0) return

    // Ajuste: la imagen debe ocupar como mucho el 25% de la pantalla
    const screenH = Dimensions.get('window').height
    const maxDisplayH = screenH * 0.25

    // Altura "natural" si ocupáramos el ancho completo
    const baseH = containerW / aspectRatio

    // Si baseH excede 25% pantalla, recortamos altura y ajustamos ancho
    const displayH = Math.min(baseH, maxDisplayH)
    const displayW = baseH <= maxDisplayH ? containerW : displayH * aspectRatio

    setDisplaySize({ w: displayW, h: displayH })

    // Estas dimensiones gobiernan pinch/pan/clamp (tamaño real renderizado)
    boxWsv.value = displayW
    boxHsv.value = displayH
    contentWsv.value = displayW
    contentHsv.value = displayH
  }

  // PINCH
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          'worklet'
          savedScale.value = scale.value
        })
        .onUpdate(e => {
          'worklet'
          const next = clamp(savedScale.value * e.scale, 1, maxScale)
          scale.value = next
        })
        .onEnd(() => {
          'worklet'
          if (scale.value <= 1) {
            scale.value = withTiming(1)
            translateX.value = withTiming(0)
            translateY.value = withTiming(0)
            runOnJS(notifyZoom)(false)
          } else {
            const overflowW = Math.max(0, contentWsv.value * scale.value - boxWsv.value)
            const overflowH = Math.max(0, contentHsv.value * scale.value - boxHsv.value)
            const maxX = overflowW / 2
            const maxY = overflowH / 2
            translateX.value = withTiming(clamp(translateX.value, -maxX, maxX))
            translateY.value = withTiming(clamp(translateY.value, -maxY, maxY))
            runOnJS(notifyZoom)(true)
          }
        }),
    [
      maxScale,
      notifyZoom,
      boxWsv,
      boxHsv,
      contentWsv,
      contentHsv,
      scale,
      savedScale,
      translateX,
      translateY,
    ],
  )

  // PAN
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet'
          startX.value = translateX.value
          startY.value = translateY.value
        })
        .onUpdate(e => {
          'worklet'
          if (scale.value <= 1) return
          const overflowW = Math.max(0, contentWsv.value * scale.value - boxWsv.value)
          const overflowH = Math.max(0, contentHsv.value * scale.value - boxHsv.value)
          const maxX = overflowW / 2
          const maxY = overflowH / 2
          const nextX = clamp(startX.value + e.translationX, -maxX, maxX)
          const nextY = clamp(startY.value + e.translationY, -maxY, maxY)
          translateX.value = nextX
          translateY.value = nextY
        })
        .onEnd(() => {
          'worklet'
          if (scale.value <= 1) {
            translateX.value = withTiming(0)
            translateY.value = withTiming(0)
          } else {
            const overflowW = Math.max(0, contentWsv.value * scale.value - boxWsv.value)
            const overflowH = Math.max(0, contentHsv.value * scale.value - boxHsv.value)
            const maxX = overflowW / 2
            const maxY = overflowH / 2
            translateX.value = withTiming(clamp(translateX.value, -maxX, maxX))
            translateY.value = withTiming(clamp(translateY.value, -maxY, maxY))
          }
        }),
    [boxWsv, boxHsv, contentWsv, contentHsv, scale, startX, startY, translateX, translateY],
  )

  // DOUBLE TAP (zoom centrado en el toque)
  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(e => {
          'worklet'
          if (boxWsv.value === 0 || boxHsv.value === 0) return
          if (scale.value > 1) {
            // reset
            scale.value = withTiming(1)
            translateX.value = withTiming(0)
            translateY.value = withTiming(0)
            runOnJS(notifyZoom)(false)
          } else {
            const centerX = boxWsv.value / 2
            const centerY = boxHsv.value / 2
            const target = doubleTapScale

            // mover el punto tocado hacia el centro al ampliar
            const dx = e.x - centerX
            const dy = e.y - centerY
            const nextTX = -dx * (target - 1)
            const nextTY = -dy * (target - 1)

            // clamp final con target
            const overflowW = Math.max(0, contentWsv.value * target - boxWsv.value)
            const overflowH = Math.max(0, contentHsv.value * target - boxHsv.value)
            const maxX = overflowW / 2
            const maxY = overflowH / 2

            translateX.value = withTiming(clamp(nextTX, -maxX, maxX))
            translateY.value = withTiming(clamp(nextTY, -maxY, maxY))
            scale.value = withTiming(target)
            runOnJS(notifyZoom)(true)
          }
        }),
    [
      doubleTapScale,
      notifyZoom,
      boxWsv,
      boxHsv,
      contentWsv,
      contentHsv,
      scale,
      translateX,
      translateY,
    ],
  )

  const composed = useMemo(
    () => Gesture.Simultaneous(pinch, pan, doubleTap),
    [pinch, pan, doubleTap],
  )

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }
  })

  return (
    <View
      style={[styles.container, { alignItems: 'center' }, style]}
      onLayout={onLayout}
      accessible
      accessibilityLabel="Imagen zoomable"
    >
      <GestureDetector gesture={composed}>
        <AnimatedImage
          source={source}
          style={[styles.image, { width: displaySize.w, height: displaySize.h }, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </View>
  )
}

export default ZoomableImage
