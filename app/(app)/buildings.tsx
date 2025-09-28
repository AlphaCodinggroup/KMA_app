import { Text, StyleSheet } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import BuildingList from '@features/building/ui/BuildingList'
import { MOCK_BUILDINGS } from '@features/building/data/mockBuildings'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * Pantalla “Select building”
 * - Header con back + título
 * - Subtítulo
 * - Lista de buildings (mock)
 *
 * Solo UI (sin navegación ni lógica de negocio).
 */
const BuildingsScreen: React.FC = () => {
  const router = useRouter()
  return (
    <SafeAreaView style={styles.container}>
      {/* Header (Expo Router) */}
      <Stack.Screen
        options={{
          title: 'Select building',
        }}
      />

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
    </SafeAreaView>
  )
}
export default BuildingsScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: '#475569', // slate-600
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 12,
  },
})
