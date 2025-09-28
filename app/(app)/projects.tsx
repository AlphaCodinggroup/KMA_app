import { useMemo } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { mockProjects } from '@features/selector/data/mockProjects'
import { AppColors } from '@shared/ui/colors'
import { SafeAreaView } from 'react-native-safe-area-context'
import ProjectsList from '@features/projects/ui/ProjectList'

const SelectProjectScreen: React.FC = () => {
  const router = useRouter()
  const items = useMemo(() => mockProjects, [])

  return (
    <SafeAreaView style={styles.container}>
      {/* Header controlado por Stack.Screen ↓ */}
      <Stack.Screen
        options={{
          title: 'Select Project',
          headerBackVisible: false,
          headerStyle: { backgroundColor: AppColors.Background },
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />

      <View style={styles.headerBlock}>
        <Text style={styles.h1}>My Projects</Text>
        <Text style={styles.h2}>Select the project to audit</Text>
      </View>

      <ProjectsList items={items} onSelect={() => router.replace('/(app)/buildings')} />
    </SafeAreaView>
  )
}

export default SelectProjectScreen

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Background },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  h1: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    color: '#0B0F12',
    marginBottom: 6,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    color: '#6B7480',
    fontWeight: '600',
  },
})
