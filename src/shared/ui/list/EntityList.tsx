import React, { memo } from 'react'
import {
  FlatList,
  View,
  type ViewStyle,
  type ListRenderItemInfo,
  type StyleProp,
} from 'react-native'
import { styles } from './styles/entityList.styles'

export interface EntityListProps<T> {
  items: ReadonlyArray<T>
  renderItem: (item: T, index: number) => React.ReactElement
  keyExtractor: (item: T, index: number) => string
  contentContainerStyle?: StyleProp<ViewStyle>
  ItemSeparatorComponent?: React.ComponentType | null
  itemSpacing?: number
  ListEmptyComponent?: React.ComponentType | null
  testID?: string
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled'
}

function EntityListInner<T>({
  items,
  renderItem,
  keyExtractor,
  contentContainerStyle,
  ItemSeparatorComponent,
  itemSpacing = 12,
  ListEmptyComponent,
  testID,
  keyboardShouldPersistTaps = 'handled',
}: EntityListProps<T>) {
  const Separator =
    ItemSeparatorComponent ??
    (() => <View style={{ height: itemSpacing }} accessibilityElementsHidden />)

  const render = ({ item, index }: ListRenderItemInfo<T>) => renderItem(item, index)

  return (
    <FlatList
      testID={testID}
      data={items}
      renderItem={render}
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={ListEmptyComponent ?? DefaultEmpty}
      contentContainerStyle={[styles.container, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      // Para listas “tarjeteadas” no queremos scroll indicators por defecto
      showsVerticalScrollIndicator={false}
    />
  )
}

const DefaultEmpty = () => <View style={styles.defaultEmpty} />

const EntityList = memo(EntityListInner) as typeof EntityListInner
export default EntityList
