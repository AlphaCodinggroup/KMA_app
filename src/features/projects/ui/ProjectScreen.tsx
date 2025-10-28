import { useCallback, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { mockProjects } from '@features/selector/data/mockProjects'
import ProjectsList from '@features/projects/ui/ProjectList'
import { styles } from './styles/projects.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const items = useMemo(() => mockProjects, [])

  const handleNavigate = useCallback(() => router.push('/(app)/buildings'), [router])

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <SubHeadline text="Select a project assigned to me" />
      </View>
      <ProjectsList items={items} onPressItem={handleNavigate} />
    </View>
  )
}

export default ProjectsScreen
