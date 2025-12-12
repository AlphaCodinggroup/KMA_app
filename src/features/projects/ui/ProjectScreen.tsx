import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { EntityErrorState } from '@shared/ui/states/EntityErrorState'
import { loadAllFlowsWithSteps } from '@features/selector/application/usecases'

const ProjectsScreen: React.FC = () => {
  const router = useRouter()
  const { items, loading, refresh, refreshing, error } = useProjects()
  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  useEffect(() => {
    const warmupFlows = async () => {
      try {
        await loadAllFlowsWithSteps()
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[ProjectsScreen] Warmup flows failed', err)
        }
      }
    }

    void warmupFlows()
  }, [])

  const handleNavigate = useCallback(
    (item: Project) => {
      router.push({
        pathname: '/(app)/facilities',
        params: {
          projectId: item.id,
          facilities: JSON.stringify(item.facilities ?? []),
        },
      })
    },
    [router],
  )

  // Letras únicas disponibles (derivadas de los proyectos cargados: remoto o cache)
  const availableLetters = useMemo<string[]>(
    () => getAvailableLetters(items, it => it.name),
    [items],
  )

  // Lista filtrada
  const filteredItems = useMemo<Project[]>(
    () => filterItemsByLetter(items, selectedLetter, it => it.name),
    [items, selectedLetter],
  )

  // Estado de carga inicial
  if (loading && items.length === 0) return <Loader loading={true} />

  // Error sin ningún dato disponible (ni remoto ni cache)
  if (!loading && error && items.length === 0) {
    return (
      <EntityErrorState
        title="Select a project"
        message="There was a problem loading projects. Please check your connection and try again."
      />
    )
  }

  // Sin proyectos para mostrar (caso vacío real)
  if (!loading && items.length === 0)
    return <Loader text="No projects to display." refresh={refresh} />

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
