import { View } from 'react-native'
import { useRouter } from 'expo-router'
import BuildingList from '@features/building/ui/BuildingList'
import { MOCK_BUILDINGS } from '@features/building/data/mockBuildings'
import { styles } from './styles/buildings.styles'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import { useCallback } from 'react'

const BuildingsScreen: React.FC = () => {
  const router = useRouter()

  const handleNavigate = useCallback(() => router.push('/(app)/selector'), [router])
  return (
    <View style={styles.container}>
      <SubHeadline text="Select a facility to audit" stylesText={styles.text} />
      <BuildingList
        items={MOCK_BUILDINGS}
        onPressItem={handleNavigate}
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
}
export default BuildingsScreen
