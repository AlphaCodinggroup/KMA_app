import React, { memo, useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import EntityList from '@shared/ui/list/EntityList'
import FlowCard from './FlowCard'

export interface FlowListProps {
  items: ReadonlyArray<FlowSummary>
  onPressItem: (item: FlowSummary) => void
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
}

const FlowList: React.FC<FlowListProps> = ({
  items,
  onPressItem,
  contentContainerStyle,
  testID,
}) => {
  const keyExtractor = useCallback((item: FlowSummary) => item.id, [])

  const renderItem = useCallback(
    (item: FlowSummary) => {
      const baseProps = {
        title: item.title,
        version: item.version,
        description: item.description ?? '',
        stepsCount: item.stepsCount ?? 0,
        onPress: () => onPressItem(item),
      }
      return <FlowCard {...baseProps} {...(testID ? { testID } : {})} />
    },
    [onPressItem, testID],
  )

  return (
    <EntityList<FlowSummary>
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      {...(contentContainerStyle ? { contentContainerStyle } : {})}
      {...(testID ? { testID } : {})}
      itemSpacing={12}
    />
  )
}

export default memo(FlowList)
