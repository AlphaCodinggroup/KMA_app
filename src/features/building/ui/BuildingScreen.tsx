import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import BuildingList from '@features/building/ui/BuildingList'
import { MOCK_BUILDINGS } from '@features/building/data/mockBuildings'
import { styles } from './styles/buildings.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'

const BuildingsScreen: React.FC = () => {
  const router = useRouter()
  const { projectId } = useLocalSearchParams<{ projectId?: string }>()
  return (
    <View style={styles.container}>
      {/* Subtítulo */}
      <SubHeadline text="Select the building to audits" stylesText={styles.text} />

      {/* Lista (UI) */}
      <BuildingList
        items={MOCK_BUILDINGS}
        onPressItem={() => router.push('/(app)/selector')}
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
}
export default BuildingsScreen
