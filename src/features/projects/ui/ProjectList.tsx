import React from 'react'
import { FlatList, View } from 'react-native'
import type { Project } from '@entities/project/model'
import ProjectCard from './ProjectCard'
import { styles } from './styles/projectList.styles'

type Props = {
  items: Project[]
  onSelect?: (p: Project) => void
}

const keyExtractor = (item: Project) => item.id

const ProjectsList: React.FC<Props> = ({ items, onSelect }) => {
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      renderItem={({ item }) => <ProjectCard project={item} onPress={onSelect} />}
    />
  )
}

export default ProjectsList
