import React, { useMemo } from 'react'
import { View, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { AppColors } from '@shared/ui/colors'
import { MOCK_FLOWS } from '@shared/mocks/flows'
import { useRouter } from 'expo-router'

export default function SelectorScreen() {
  const router = useRouter()
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
      <Text style={styles.headerTitle}>Select a section</Text>
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/flow/${item.id}`)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <Text style={styles.cardMeta}>
              {item.version} • {item.stepsCount} steps
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  headerTitle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.Primary,
  },
  separator: { height: 12 },
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    shadowColor: AppColors.Shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppColors.Primary },
  cardDesc: { marginTop: 4, color: AppColors.MutedText },
  cardMeta: { marginTop: 8, fontSize: 12, color: AppColors.MutedText },
})
