import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { mockProjects } from '@features/selector/data/mockProjects'
import ProjectsList from '@features/projects/ui/ProjectList'
import { styles } from './styles/projects.styles'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const items = useMemo(() => mockProjects, [])

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.h1}>My Projects</Text>
        <Text style={styles.h2}>Select the project to audit</Text>
      </View>

      <ProjectsList items={items} onPressItem={() => router.push('/(app)/buildings')} />
    </View>
  )
}

export default ProjectsScreen
