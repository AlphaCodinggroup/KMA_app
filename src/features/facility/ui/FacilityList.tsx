import React, { memo, useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import EntityList from '@shared/ui/list/EntityList'
import type { Facility } from '@entities/facility/model'
import ListItemCard from '@shared/ui/list/ListItemCard'

export interface FacilityListProps {
  items: ReadonlyArray<Facility>
  onPressItem: (item: Facility) => void
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
  refreshing?: boolean
  onRefresh?: () => void
}

const FacilityList: React.FC<FacilityListProps> = ({
  items,
  onPressItem,
  contentContainerStyle,
  testID,
  refreshing = false,
  onRefresh,
}) => {
  const keyExtractor = useCallback((item: Facility) => item.id, [])

  const renderItem = useCallback(
    (item: Facility) => {
      const baseProps = {
        title: item.name,
        onPress: () => onPressItem(item),
      }
      return <ListItemCard {...baseProps} {...(testID ? { testID } : {})} />
    },
    [onPressItem, testID],
  )

  return (
    <EntityList<Facility>
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={refreshing}
      {...(onRefresh ? { onRefresh } : {})}
      {...(contentContainerStyle ? { contentContainerStyle } : {})}
      {...(testID ? { testID } : {})}
      itemSpacing={12}
    />
  )
}

export default memo(FacilityList)
