import React, { memo } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { AppColors } from '../colors'

export type IconName =
  | 'chevronRight'
  | 'chevronLeft'
  | 'arrowRight'
  | 'arrowLeft'
  | 'check'
  | 'close'
  | 'info'
  | 'warning'
  | 'error'
  | 'folder'
  | 'building'
  | 'camera'
  | 'download'
  | 'edit'
  | 'trash'
  | 'eye'
  | 'eyeOff'

type RegistryItem =
  | { lib: 'ion'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | {
      lib: 'mci'
      name: React.ComponentProps<typeof MaterialCommunityIcons>['name']
    }

const REGISTRY: Record<IconName, RegistryItem> = {
  chevronRight: { lib: 'ion', name: 'chevron-forward' },
  chevronLeft: { lib: 'ion', name: 'chevron-back' },
  arrowRight: { lib: 'ion', name: 'arrow-forward' },
  arrowLeft: { lib: 'ion', name: 'arrow-back' },
  check: { lib: 'ion', name: 'checkmark' },
  close: { lib: 'ion', name: 'close' },
  info: { lib: 'ion', name: 'information-circle' },
  warning: { lib: 'ion', name: 'warning' },
  error: { lib: 'ion', name: 'close-circle' },
  folder: { lib: 'mci', name: 'folder-outline' },
  building: { lib: 'mci', name: 'office-building-outline' },
  camera: { lib: 'mci', name: 'camera-outline' },
  download: { lib: 'mci', name: 'download-outline' },
  edit: { lib: 'mci', name: 'pencil-outline' },
  trash: { lib: 'mci', name: 'trash-can-outline' },
  eye: { lib: 'ion', name: 'eye' },
  eyeOff: { lib: 'ion', name: 'eye-off' },
}

export interface IconProps {
  name: IconName
  size?: number
  color?: string
  style?: StyleProp<TextStyle>
  testID?: string
  accessibilityLabel?: string
}

/**
 * Icon — Wrapper de íconos unificado.
 * - Estándariza nombres y colores.
 * - Permite cambiar de set (Ionicons/MaterialCommunityIcons) sin tocar las features.
 *
 * Ejemplo:
 *  <Icon name="chevronRight" />
 *  <Icon name="camera" size={24} color={Colors.primary} />
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = AppColors.IconMuted,
  style,
  testID,
  accessibilityLabel,
}) => {
  const item = REGISTRY[name]

  if (!item) {
    // Fallback seguro si falta un mapeo
    return (
      <Ionicons
        name="help-circle-outline"
        size={size}
        color={color}
        style={style}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? name}
      />
    )
  }

  if (item.lib === 'ion') {
    return (
      <Ionicons
        name={item.name}
        size={size}
        color={color}
        style={style}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? name}
      />
    )
  }

  return (
    <MaterialCommunityIcons
      name={item.name}
      size={size}
      color={color}
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? name}
    />
  )
}

export default memo(Icon)
