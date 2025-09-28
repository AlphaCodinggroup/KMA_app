import React from 'react'
import { FlatList, type ListRenderItemInfo, View, StyleSheet, type ViewStyle } from 'react-native'
import type { Building } from '@entities/building/model'
import BuildingCard from './BuildingCard'

export interface BuildingListProps {
  items: ReadonlyArray<Building>
  contentContainerStyle?: ViewStyle
  onPressItem?: (building: Building) => void
  testID?: string
}

/**
 * Lista virtualizada de Buildings (solo UI).
 * Reutiliza BuildingCard y define separadores/espaciados consistentes.
 */
const BuildingList: React.FC<BuildingListProps> = ({
  items,
  contentContainerStyle,
  onPressItem,
  testID = 'building-list',
}) => {
  const renderItem = ({ item }: ListRenderItemInfo<Building>) => (
    <BuildingCard
      title={item.name}
      onPress={() => onPressItem?.(item)}
      testID={`building-card-${item.id}`}
    />
  )

  return (
    <FlatList
      testID={testID}
      data={items}
      keyExtractor={it => it.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={<View style={styles.headerSpacer} />}
      ListFooterComponent={<View style={styles.footerSpacer} />}
      contentContainerStyle={[styles.container, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  )
}

export default BuildingList

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  headerSpacer: {
    height: 8,
  },
  footerSpacer: {
    height: 16,
  },
  separator: {
    height: 12,
  },
})
