import React, { memo, useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Building } from '@entities/building/model'
import EntityList from '@shared/ui/list/EntityList'
import BuildingCard from './BuildingCard'

export interface BuildingListProps {
  items: ReadonlyArray<Building>
  onPressItem: (item: Building) => void
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
}

const BuildingList: React.FC<BuildingListProps> = ({
  items,
  onPressItem,
  contentContainerStyle,
  testID,
}) => {
  const keyExtractor = useCallback((item: Building) => item.id, [])

  const renderItem = useCallback(
    (item: Building) => {
      const baseProps = {
        title: item.name,
        onPress: () => onPressItem(item),
      }
      return <BuildingCard {...baseProps} {...(testID ? { testID } : {})} />
    },
    [onPressItem, testID],
  )

  return (
    <EntityList<Building>
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      {...(contentContainerStyle ? { contentContainerStyle } : {})}
      {...(testID ? { testID } : {})}
      itemSpacing={12}
    />
  )
}

export default memo(BuildingList)
