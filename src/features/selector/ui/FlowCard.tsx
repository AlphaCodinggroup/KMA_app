import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { AppColors } from '@shared/ui/colors'

type Props = {
  item: FlowSummary
  onPress?: (item: FlowSummary) => void
  testID?: string
}

export function FlowCard({ item, onPress, testID }: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={() => onPress?.(item)}
      style={styles.card}
      activeOpacity={0.88}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
      </View>

      {!!item.description && <Text style={styles.description}>{item.description}</Text>}

      <View style={styles.footer}>
        <Text style={styles.meta}>{item.stepsCount} pasos</Text>
        <Text style={styles.meta}>{item.version}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { marginBottom: 4, borderBottomWidth: 0, borderBottomColor: AppColors.Border },
  title: { fontSize: 16, fontWeight: '700', color: AppColors.Primary },
  description: { marginTop: 6, color: AppColors.MutedText },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: { fontSize: 12, color: AppColors.MutedText },
})
