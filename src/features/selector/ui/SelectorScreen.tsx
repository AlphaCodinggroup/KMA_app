import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { loadAllFlowsWithSteps } from '@features/selector/application/usecases'
import { styles } from './styles/selector.styles'
import FlowList, { type FlowListItem } from './FlowList'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import Loader from '@shared/ui/loader/Loader'
import { filterItemsByLetter, getAvailableLetters, type LetterKey } from '@shared/lib/alphaFilter'
import LetterFilter from '@shared/ui/filters/LetterFilter'

const SelectorScreen: React.FC = () => {
  const router = useRouter()
  const { projectId, facilityId } = useLocalSearchParams<{
    projectId: string
    facilityId: string
  }>()

  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Offline-first:
      // - Online: FlowRepo va a la API y cachea en SQLite.
      // - Offline / error: intenta reconstruir desde SQLite.
      const full = await loadAllFlowsWithSteps()
      setFlows(full)
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to load flows')
      setError(err)

      if (__DEV__) {
        console.warn('[SelectorScreen] Error loading flows', err)
      }

      Alert.alert(
        'Error',
        'There was a problem loading the flows. If you are offline, please try again after reconnecting.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derivar resumen SOLO para la UI (no perdemos datos del flow completo)
  const summaries: FlowSummary[] = useMemo(
    () =>
      flows.map(f => ({
        id: f.flowId,
        title: f.title,
        version: String(f.version),
        description: f.description,
        stepsCount: f.steps.length,
        flowType: f.flowType,
        isActive: f.isActive,
      })),
    [flows],
  )

  const onPressItem = useCallback(
    (item: FlowListItem) => {
      // Si ya tenemos un Flow completo, lo usamos; si no, resolvemos por id
      const flow = (item as Flow).flowId
        ? (item as Flow)
        : flows.find(f => f.flowId === (item as FlowSummary).id)
      if (!flow) return

      // Enviar steps (camelCase) como string JSON en params
      const stepsParam = JSON.stringify(flow.steps)

      router.push({
        pathname: '/(app)/flow/[flowId]',
        params: {
          flowId: flow.flowId,
          title: flow.flowType,
          version: String(flow.version),
          steps: stepsParam,
          projectId: projectId || '',
          facilityId: facilityId || '',
        },
      })
    },
    [facilityId, flows, projectId, router],
  )

  // Letras únicas disponibles (derivadas del backend / cache)
  const availableLetters = useMemo<string[]>(
    () => getAvailableLetters(summaries, it => it.flowType),
    [summaries],
  )

  // Lista filtrada por letra
  const filteredItems = useMemo<FlowSummary[]>(
    () => filterItemsByLetter(summaries, selectedLetter, it => it.flowType),
    [summaries, selectedLetter],
  )

  if (loading) return <Loader loading={loading} />

  return (
    <View style={styles.container}>
      <SubHeadline text="Select a flow" stylesText={styles.text} />
      <LetterFilter
        letters={availableLetters}
        selected={selectedLetter}
        onSelect={setSelectedLetter}
      />
      <FlowList items={filteredItems} onPressItem={onPressItem} />
    </View>
  )
}

export default SelectorScreen
