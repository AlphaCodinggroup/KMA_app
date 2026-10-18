import React, { memo, useCallback } from 'react'
import { SectionList, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import type { FlowSummary, Flow } from '@entities/flow/model'
import FlowCard from './FlowCard'
import type { FlowSection } from '../lib/groupFlowsByCategory'
import { styles } from './styles/selector.styles'

// Permite usar el resumen actual o el flow completo
export type FlowListItem = FlowSummary | Flow

export interface FlowListProps {
  sections: ReadonlyArray<FlowSection>
  onPressItem: (item: FlowListItem) => void
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshing?: boolean
  onRefresh?: () => void
  testID?: string
}

const isFlow = (item: FlowListItem): item is Flow =>
  // Heurística simple: Flow tiene `flowId` y `steps`
  (item as Flow).flowId !== undefined

const FlowList: React.FC<FlowListProps> = ({
  sections,
  onPressItem,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
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
    <SectionList<FlowListItem, FlowSection>
      testID={testID}
      sections={sections as FlowSection[]}
      renderItem={({ item }) => renderItem(item)}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
        </View>
      )}
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={Separator}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  )
}

const Separator = () => <View style={styles.itemSeparator} accessibilityElementsHidden />

export default memo(FlowList)
