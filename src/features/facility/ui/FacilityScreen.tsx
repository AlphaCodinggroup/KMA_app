import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import { styles } from './styles/facility-screen.styles'
import FacilityList from './FacilityList'
import { useFacilitiesByProject } from '../application/usecases'
import { useCallback, useMemo, useState } from 'react'
import Loader from '@shared/ui/loader/Loader'
import type { Facility } from '@entities/facility/model'
import LetterFilter from '@shared/ui/filters/LetterFilter'
import { filterItemsByLetter, getAvailableLetters, type LetterKey } from '@shared/lib/alphaFilter'

const FacilityScreen: React.FC = () => {
  const router = useRouter()
  const { projectId } = useLocalSearchParams<{ projectId: string }>()
  const { items, loading, refresh, refreshing } = useFacilitiesByProject(projectId)
  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  const handlePressItem = useCallback(
    (item: Facility) => {
      router.push({
        pathname: '/(app)/selector',
        params: { facilityId: item.id, projectId },
      })
    },
    [router, projectId],
  )

  // Letras únicas disponibles (derivadas del backend)
  const availableLetters = useMemo<string[]>(
    () => getAvailableLetters(items, it => it.name),
    [items],
  )

  // Lista filtrada
  const filteredItems = useMemo<Facility[]>(
    () => filterItemsByLetter(items, selectedLetter, it => it.name),
    [items, selectedLetter],
  )

  if (loading) return <Loader loading={loading} />

  if (!loading && items.length === 0) return <Loader text="No facilities to display." />

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
