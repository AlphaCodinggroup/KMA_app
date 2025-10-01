import React, { memo } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { AppColors } from '../colors'
import { styles } from './styles/listItemCard.styles'
import Icon from '../icons/Icon'

export interface ListItemCardProps {
  title: string | React.ReactNode
  subtitle?: string | React.ReactNode
  description?: string | React.ReactNode
  steps?: string | React.ReactNode
  version?: string
  left?: React.ReactNode
  right?: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  selected?: boolean
  chevron?: boolean
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
  subtitleStyle?: StyleProp<TextStyle>
  descriptionStyle?: StyleProp<TextStyle>
  testID?: string
  accessibilityLabel?: string
}

const ListItemCard: React.FC<ListItemCardProps> = ({
  title,
  subtitle,
  description,
  steps,
  version,
  left,
  right,
  onPress,
  disabled = false,
  loading = false,
  selected = false,
  chevron = true,
  style,
  contentStyle,
  titleStyle,
  subtitleStyle,
  descriptionStyle,
  testID,
  accessibilityLabel,
}) => {
  const isPressable = typeof onPress === 'function' && !disabled && !loading

  // Accesibilidad básica combinando título/subtítulo si no se provee label.
  const a11yLabel =
    accessibilityLabel ??
    [
      typeof title === 'string' ? title : undefined,
      typeof subtitle === 'string' ? subtitle : undefined,
    ]
      .filter(Boolean)
      .join('. ')

  return (
    <View style={[styles.card, selected && styles.cardSelected, style]}>
      <Pressable
        testID={testID}
        accessibilityRole={isPressable ? 'button' : 'text'}
        accessibilityState={{ disabled, selected }}
        accessibilityLabel={a11yLabel}
        onPress={isPressable ? onPress : undefined}
        android_ripple={isPressable ? { color: AppColors.Ripple } : undefined}
        style={({ pressed }) => [
          styles.row,
          pressed && isPressable ? styles.pressed : null,
          contentStyle,
        ]}
      >
        {left ? <View style={styles.left}>{left}</View> : null}

        <View style={styles.center}>
          {typeof title === 'string' ? (
            <Text numberOfLines={1} style={[styles.title, titleStyle]}>
              {title}
            </Text>
          ) : (
            title
          )}

          {subtitle ? (
            typeof subtitle === 'string' ? (
              <Text numberOfLines={1} style={[styles.subtitle, subtitleStyle]}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          ) : null}

          {description ? (
            typeof description === 'string' ? (
              <Text numberOfLines={3} style={[styles.description, descriptionStyle]}>
                {description}
              </Text>
            ) : (
              description
            )
          ) : null}

          {steps ? (
            typeof description === 'string' ? (
              <Text style={styles.meta}>
                {steps ? `${steps} steps` : '—'} · {version}
              </Text>
            ) : (
              steps
            )
          ) : null}
        </View>

        <View style={styles.right}>
          {loading ? (
            <ActivityIndicator />
          ) : right ? (
            right
          ) : chevron && isPressable ? (
            <Icon name="chevronRight" size={22} color={AppColors.IconMuted} />
          ) : null}
        </View>
      </Pressable>
    </View>
  )
}

export default memo(ListItemCard)
