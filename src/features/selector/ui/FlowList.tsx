import React, { memo, useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { FlowSummary, Flow } from '@entities/flow/model'
import EntityList from '@shared/ui/list/EntityList'
import FlowCard from './FlowCard'

// Permite usar el resumen actual o el flow completo
export type FlowListItem = FlowSummary | Flow

export interface FlowListProps {
  items: ReadonlyArray<FlowListItem>
  onPressItem: (item: FlowListItem) => void
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
}

const isFlow = (item: FlowListItem): item is Flow =>
  // Heurística simple: Flow tiene `flowId` y `steps`
  (item as Flow).flowId !== undefined

const FlowList: React.FC<FlowListProps> = ({
  items,
  onPressItem,
  contentContainerStyle,
  testID,
}) => {
  const keyExtractor = useCallback(
    (item: FlowListItem) => (isFlow(item) ? item.flowId : item.id),
    [],
  )

  const renderItem = useCallback(
    (item: FlowListItem) => {
      const title = item.title ?? ''
      const version = `v ${isFlow(item) ? String(item.version) : item.version}`
      const description = (item as FlowSummary).description ?? (item as Flow).description ?? ''
      const stepsCount = isFlow(item) ? item.steps.length : (item.stepsCount ?? 0)

      return (
        <FlowCard
          title={title}
          version={version}
          description={description}
          stepsCount={stepsCount}
          onPress={() => onPressItem(item)}
          {...(testID ? { testID } : {})}
        />
      )
    },
    [onPressItem, testID],
  )

  return (
    <EntityList<FlowListItem>
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
