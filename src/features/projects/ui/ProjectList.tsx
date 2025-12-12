import React, { memo, useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import EntityList from '@shared/ui/list/EntityList'
import ProjectCard from './ProjectCard'
import type { Project } from '@entities/project/model'

export interface ProjectListProps {
  items: ReadonlyArray<Project>
  onPressItem: (item: Project) => void
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
  refreshing?: boolean
  onRefresh?: () => void
}

const ProjectList: React.FC<ProjectListProps> = ({
  items,
  onPressItem,
  contentContainerStyle,
  testID,
  refreshing = false,
  onRefresh,
}) => {
  const keyExtractor = useCallback((item: Project) => item.id, [])

  const renderItem = useCallback(
    (item: Project) => {
      const baseProps = {
        title: item.name ?? '',
        onPress: () => onPressItem(item),
      }
      return <ProjectCard {...baseProps} />
    },
    [onPressItem],
  )

  return (
    <EntityList<Project>
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

export default memo(ProjectList)
