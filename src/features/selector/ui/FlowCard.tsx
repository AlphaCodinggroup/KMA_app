import React, { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { AppColors } from '@shared/ui/colors'

type Props = {
  item: FlowSummary
  onPress?: (item: FlowSummary) => void
  testID?: string
}

const FlowCardComponent: React.FC<Props> = ({ item, onPress, testID }) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Seleccionar flow ${item.title}`}
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.version}>{item.version}</Text>
      </View>

      {!!item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {typeof item.stepsCount === 'number' ? `${item.stepsCount} pasos` : '—'}
        </Text>
      </View>
    </Pressable>
  )
}

export const FlowCard = memo(FlowCardComponent)

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Divider,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    flex: 1,
    color: AppColors.Text,
    fontSize: 16,
    fontWeight: '700',
  },
  version: {
    color: AppColors.Subtext,
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    color: AppColors.Subtext,
    fontSize: 14,
  },
  metaRow: {
    marginTop: 4,
  },
  meta: {
    color: AppColors.Subtext,
    fontSize: 12,
  },
})
