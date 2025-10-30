import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import { styles } from './styles/facility-screen.styles'
import FacilityList from './FacilityList'
import { useFacilitiesByProject } from '../application/usecases'
import { useCallback } from 'react'
import Loader from '@shared/ui/loader/Loader'
import type { Facility } from '@entities/facility/model'

const FacilityScreen: React.FC = () => {
  const router = useRouter()
  const { projectId } = useLocalSearchParams<{ projectId?: string }>()
  const { items, loading, refresh, refreshing } = useFacilitiesByProject(projectId)

  const handlePressItem = useCallback(
    (item: Facility) => {
      router.push({
        pathname: '/(app)/selector',
        params: { facilityId: item.id, projectId },
      })
    },
    [router, projectId],
  )

  if (loading) return <Loader loading={loading} />

  if (!loading && items.length === 0) return <Loader text="No facilities to display." />

  return (
    <View style={styles.container}>
      <SubHeadline text="Select the facility to audits" stylesText={styles.text} />
      <FacilityList
        items={items}
        onPressItem={handlePressItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </View>
  )
}
export default FacilityScreen
