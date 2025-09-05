import React, { useMemo } from 'react'
import { View, FlatList, Text, StyleSheet } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { AppColors } from '@shared/ui/colors'
import { MOCK_FLOWS } from '@shared/mocks/flows'

export default function SelectorScreen() {
  const data: FlowSummary[] = useMemo(
    () =>
      (MOCK_FLOWS.flows ?? []).map(f => ({
        id: f.id,
        title: f.title,
        version: f.version,
        description: f.description ?? '',
        stepsCount: f.stepsCount ?? 0,
      })),
    [],
  )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seleccioná un flujo</Text>
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <FlowCard item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  )
}

function FlowCard({ item }: { item: FlowSummary }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
      <Text style={styles.cardMeta}>
        {item.stepsCount} pasos · {item.version}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  title: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    color: AppColors.Primary,
  },
  separator: { height: 12 },
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppColors.Primary },
  cardDesc: { marginTop: 4, color: AppColors.MutedText },
  cardMeta: { marginTop: 8, fontSize: 12, color: AppColors.MutedText },
})
