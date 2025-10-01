import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import BuildingList from '@features/building/ui/BuildingList'
import { MOCK_BUILDINGS } from '@features/building/data/mockBuildings'
import { styles } from './styles/buildings.styles'

const BuildingsScreen: React.FC = () => {
  const router = useRouter()
  return (
    <View style={styles.container}>
      {/* Subtítulo */}
      <Text style={styles.subtitle} accessibilityRole="header">
        Select the building to audits
      </Text>

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
