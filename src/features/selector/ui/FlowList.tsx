import React from 'react'
import { FlatList, type ListRenderItem, StyleSheet, View } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { FlowCard } from './FlowCard'
import { AppColors } from '@shared/ui/colors'

type Props = {
  data: FlowSummary[]
  onSelect?: (item: FlowSummary) => void
  contentPadding?: number
}

export const FlowList: React.FC<Props> = ({ data, onSelect, contentPadding = 16 }) => {
  const renderItem: ListRenderItem<FlowSummary> = ({ item, index }) => (
    <FlowCard item={item} onPress={onSelect} testID={`flow-card-${index}`} />
  )

  return (
    <FlatList
      data={data}
      keyExtractor={it => it.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={{ padding: contentPadding }}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  separator: {
    height: 12,
    backgroundColor: AppColors.Background,
  },
})
