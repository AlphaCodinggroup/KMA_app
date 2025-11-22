import React, { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import ProjectsList from '@features/projects/ui/ProjectList'
import { useProjects } from '@features/projects'
import { styles } from './styles/projects.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import Loader from '@shared/ui/loader/Loader'
import type { Project } from '@entities/project/model'
import { filterItemsByLetter, getAvailableLetters, type LetterKey } from '@shared/lib/alphaFilter'
import LetterFilter from '@shared/ui/filters/LetterFilter'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const { items, loading, refresh, refreshing } = useProjects()
  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  const handleNavigate = useCallback(
    (item: Project) => {
      router.push({
        pathname: '/(app)/facilities',
        params: { projectId: item.id },
      })
    },
    [router],
  )

  // Letras únicas disponibles (derivadas del backend)
  const availableLetters = useMemo<string[]>(
    () => getAvailableLetters(items, it => it.name),
    [items],
  )

  // Lista filtrada
  const filteredItems = useMemo<Project[]>(
    () => filterItemsByLetter(items, selectedLetter, it => it.name),
    [items, selectedLetter],
  )

  if (loading) return <Loader loading={loading} />

  if (items.length === 0) return <Loader text="No projects to display." />

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <SubHeadline text="Select a project" />
      </View>
      <LetterFilter
        letters={availableLetters}
        selected={selectedLetter}
        onSelect={setSelectedLetter}
      />
      <ProjectsList
        items={filteredItems}
        onPressItem={handleNavigate}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </View>
  )
}

export default ProjectsScreen
