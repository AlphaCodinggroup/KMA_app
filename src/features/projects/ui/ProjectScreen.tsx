import React, { useCallback } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import ProjectsList, { type ProjectListItem } from '@features/projects/ui/ProjectList'
import { useProjects } from '@features/projects'
import { styles } from './styles/projects.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const { items, loading, refresh, refreshing } = useProjects()

  const handleNavigate = useCallback(
    (item: ProjectListItem) => {
      router.push({
        pathname: '/(app)/buildings',
        params: { projectId: item.id },
      })
    },
    [router],
  )
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notContent}>No projects to display.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.h1}>My Projects</Text>
        <SubHeadline text="Select the project to audit" />
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
