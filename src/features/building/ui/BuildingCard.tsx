// /src/features/building/ui/BuildingCard.tsx
import React from 'react'
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Ionicons } from '@expo/vector-icons'

export interface BuildingCardProps {
  title: string
  onPress?: (e: GestureResponderEvent) => void
  testID?: string
  style?: ViewStyle
  titleStyle?: TextStyle
  /** Si querés reemplazar el ícono por defecto */
  leftIconName?: keyof typeof MaterialCommunityIcons.glyphMap
}

/**
 * Card táctil para listar un Building.
 * Reutilizable (selector/listas). Solo UI → sin lógica de negocio.
 */
const BuildingCard: React.FC<BuildingCardProps> = ({
  title,
  onPress,
  testID,
  style,
  titleStyle,
  leftIconName = 'office-building',
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      <View style={styles.leftIconWrap}>
        <MaterialCommunityIcons
          name={leftIconName}
          size={24}
          color="#0F172A" // slate-900
        />
      </View>

      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.title, titleStyle]} accessibilityLabel={title}>
          {title}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
    </Pressable>
  )
}

export default BuildingCard

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB', // gray-200
    backgroundColor: 'white',
  },
  cardPressed: {
    opacity: 0.9,
  },
  leftIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3F4F6', // gray-100
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#0B0F14',
  },
})
