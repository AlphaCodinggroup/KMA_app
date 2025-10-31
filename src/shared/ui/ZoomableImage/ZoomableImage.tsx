import React, { useMemo, useState, useCallback } from 'react'
import { Image, ImageSourcePropType, LayoutChangeEvent, StyleSheet, View } from 'react-native'
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
  style?: any
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
  // Valores "JS" solo para calcular aspectRatio; no se usan en worklets
  const asset = useMemo(() => getAssetSize(source), [source])
  const aspectRatio = useMemo(() => {
    if (style?.aspectRatio) return Number(style.aspectRatio)
    if (asset) return asset.w / asset.h
    return 16 / 9
  }, [asset, style])

  // SharedValues para que los worklets tengan acceso
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
      onZoomChange && onZoomChange(val)
    },
    [onZoomChange],
  )

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    // Actualizamos SharedValues (accesibles en worklets)
    boxWsv.value = width
    boxHsv.value = height
    contentWsv.value = width
    contentHsv.value = width / aspectRatio // alto “base” cuando scale=1 (contain horizontal)
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
            // clamp offsets con datos del box y contenido (todo en worklet)
            const overflowW = Math.max(0, contentWsv.value * scale.value - boxWsv.value)
            const overflowH = Math.max(0, contentHsv.value * scale.value - boxHsv.value)
            const maxX = overflowW / 2
            const maxY = overflowH / 2
            translateX.value = withTiming(clamp(translateX.value, -maxX, maxX))
            translateY.value = withTiming(clamp(translateY.value, -maxY, maxY))
            runOnJS(notifyZoom)(true)
          }
        }),
    [maxScale],
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
    [],
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
    [doubleTapScale],
  )

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap)

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
      style={[styles.container, style]}
      onLayout={onLayout}
      accessible
      accessibilityLabel="Imagen zoomable"
    >
      <GestureDetector gesture={composed}>
        <AnimatedImage
          source={source}
          style={[styles.image, { aspectRatio }, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </View>
  )
}

export default ZoomableImage
