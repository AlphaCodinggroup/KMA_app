import React, { useCallback } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import ProjectsList, { type ProjectListItem } from '@features/projects/ui/ProjectList'
import { useProjects } from '@features/projects'
import { styles } from './styles/projects.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import Loader from '@shared/ui/loader/Loader'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const { items, loading, refresh, refreshing } = useProjects()

  const handleNavigate = useCallback(
    (item: ProjectListItem) => {
      router.push({
        pathname: '/(app)/facilities',
        params: { projectId: item.id },
      })
    },
    [router],
  )

  if (loading) return <Loader loading={loading} />

  if (items.length === 0) return <Loader text="No projects to display." />

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <SubHeadline text="Select a project assigned to me" />
      </View>

      <ProjectsList
        items={items}
        onPressItem={handleNavigate}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </View>
  )
}

export default ProjectsScreen
