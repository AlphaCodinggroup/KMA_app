import { useCallback, useMemo, useState } from 'react'
import { View, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useNetInfo } from '@react-native-community/netinfo'

import SubHeadline from '@shared/ui/subheadline/subHeadline'
import { styles } from './styles/facility-screen.styles'
import FacilityList from './FacilityList'
import { useFacilitiesByProject } from '../application/usecases'
import Loader from '@shared/ui/loader/Loader'
import type { Facility } from '@entities/facility/model'
import type { ProjectFacilitySummary } from '@entities/project/model'
import LetterFilter from '@shared/ui/filters/LetterFilter'
import { filterItemsByLetter, getAvailableLetters, type LetterKey } from '@shared/lib/alphaFilter'

const FacilityScreen: React.FC = () => {
  const router = useRouter()
  const netInfo = useNetInfo()

  const { projectId, facilities } = useLocalSearchParams<{
    projectId: string
    facilities?: string
  }>()

  const { items, loading, refresh, refreshing, error } = useFacilitiesByProject(projectId)

  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  // Parseamos las facilities embebidas que vienen desde ProjectsScreen
  const projectFacilities = useMemo<ProjectFacilitySummary[]>(() => {
    if (!facilities) return []
    try {
      const parsed = JSON.parse(facilities)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (f): f is ProjectFacilitySummary =>
          !!f && typeof f.id === 'string' && typeof f.name === 'string',
      )
    } catch {
      return []
    }
  }, [facilities])

  const isOffline = netInfo.isConnected === false

  /**
   * Items efectivos para la lista:
   * - Si el repo de Facilities devuelve algo → usamos eso.
   * - Si NO devuelve nada, estamos offline y el Project traía facilities embebidas →
   *   usamos ese array como fallback.
   * - Si tampoco hay facilities embebidas → queda lista vacía real.
   */
  const baseItems: Facility[] = useMemo(() => {
    if (items.length > 0) return items

    if (isOffline && projectFacilities.length > 0) return projectFacilities

    return items
  }, [items, isOffline, projectFacilities])

  const handlePressItem = useCallback(
    (item: Facility) => {
      router.push({
        pathname: '/(app)/selector',
        params: { facilityId: item.id, projectId },
      })
    },
    [router, projectId],
  )

  // Letras únicas disponibles (derivadas de los items efectivos: remoto/cache o fallback)
  const availableLetters = useMemo<string[]>(
    () => getAvailableLetters(baseItems, it => it.name),
    [baseItems],
  )

  // Lista filtrada
  const filteredItems = useMemo<Facility[]>(
    () => filterItemsByLetter(baseItems, selectedLetter, it => it.name),
    [baseItems, selectedLetter],
  )

  // Estado de carga inicial (sin datos efectivos aún)
  if (loading && baseItems.length === 0) return <Loader loading={true} />

  // Error y sin ningún dato (ni repo ni fallback)
  if (!loading && error && baseItems.length === 0) {
    return (
      <View style={styles.container}>
        <SubHeadline text="Select a facility to audit" stylesText={styles.text} />
        <Text style={styles.errorText}>
          There was a problem loading facilities. Please check your connection and try again.
        </Text>
      </View>
    )
  }

  // Sin facilities para mostrar (ni de repo ni embebidas)
  if (!loading && baseItems.length === 0) return <Loader text="No facilities to display." />

  return (
    <View style={styles.container}>
      <SubHeadline text="Select a facility to audit" stylesText={styles.text} />
      <LetterFilter
        letters={availableLetters}
        selected={selectedLetter}
        onSelect={setSelectedLetter}
      />
      <FacilityList
        items={filteredItems}
        onPressItem={handlePressItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </View>
  )
}

export default FacilityScreen
