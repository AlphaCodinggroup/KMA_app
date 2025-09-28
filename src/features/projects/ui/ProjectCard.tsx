import React from 'react'
import { Pressable, Text, View } from 'react-native'
import type { Project } from '@entities/project/model'
import Folder from '@shared/ui/icons/Folder'
import ChevronRight from '@shared/ui/icons/ChevronRight'
import { styles } from './styles/projectCard.styles'

type Props = {
  project: Project
  onPress?: (p: Project) => void
  testID?: string
}

const ProjectCard: React.FC<Props> = ({ project, onPress, testID }) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(project)}
      testID={testID}
    >
      <View style={styles.leftIconBox}>
        <Folder width={28} height={28} color="#5B6B7A" />
      </View>

      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={3}>
          {project.name}
        </Text>
      </View>

      <ChevronRight width={22} height={22} color="#8A97A3" />
    </Pressable>
  )
}

export default ProjectCard
