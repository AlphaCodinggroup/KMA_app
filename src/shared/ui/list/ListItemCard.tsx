import React, { memo, useMemo } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  TouchableOpacity,
} from 'react-native'
import { AppColors } from '../colors'
import { styles } from './styles/listItemCard.styles'
import Icon from '../icons/Icon'
import { RFValue } from 'react-native-responsive-fontsize'

export interface ListItemCardProps {
  title: string
  subtitle?: string
  description?: string
  steps?: string
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
  // Accesibilidad básica combinando título/subtítulo si no se provee label.
  const a11yLabel = useMemo<string>(
    () =>
      accessibilityLabel ??
      [
        typeof title === 'string' ? title : undefined,
        typeof subtitle === 'string' ? subtitle : undefined,
      ]
        .filter(Boolean)
        .join('. '),
    [accessibilityLabel, title, subtitle],
  )

  return (
    <View style={[styles.card, selected && styles.cardSelected, style]}>
      <TouchableOpacity
        testID={testID}
        accessibilityRole={'button'}
        accessibilityState={{ disabled, selected }}
        accessibilityLabel={a11yLabel}
        onPress={onPress}
        style={[styles.row, contentStyle]}
      >
        {left ? <View style={styles.left}>{left}</View> : null}

        <View style={styles.center}>
          <Text style={[styles.title, titleStyle]}>{title}</Text>

          {subtitle && <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>}
          {description && <Text style={[styles.description, descriptionStyle]}>{description}</Text>}

          {steps && (
            <Text style={styles.meta}>
              {steps ? `${steps} steps` : '—'} · {version}
            </Text>
          )}
        </View>

        <View style={styles.right}>
          {loading ? (
            <ActivityIndicator />
          ) : right ? (
            right
          ) : chevron ? (
            <Icon name="chevronRight" size={RFValue(16)} color={AppColors.IconMuted} />
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  )
}

export default memo(ListItemCard)
