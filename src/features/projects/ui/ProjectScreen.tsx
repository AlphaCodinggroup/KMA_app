import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { mockProjects } from '@shared/mocks/mockProjects'
import ProjectsList from '@features/projects/ui/ProjectList'
import { styles } from './styles/projects.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const items = useMemo(() => mockProjects, [])

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.h1}>My Projects</Text>
        <SubHeadline text="Select the project to audit" />
      </View>

      <ProjectsList items={items} onPressItem={() => router.push('/(app)/buildings')} />
    </View>
  )
}

export default ProjectsScreen
