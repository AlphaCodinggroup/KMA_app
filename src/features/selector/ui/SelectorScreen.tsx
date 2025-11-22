import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { loadAllFlowsWithSteps, coldSyncAllFlows } from '@features/selector/application/usecases'
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
  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Placeholder de sync (en una futura iteración cachearemos en SQLite)
      await coldSyncAllFlows()
      const full = await loadAllFlowsWithSteps()
      setFlows(full)
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
        flowType: f.flowType,
      })),
    [flows],
  )

  const onPressItem = useCallback(
    (item: FlowListItem) => {
      // Si ya tenemos un Flow completo, lo usamos; si no, resolvemos por id
      const flow = (item as Flow).flowId
        ? (item as Flow)
        : flows.find(f => f.flowId === (item as FlowSummary).id)
      if (!flow) {
        Alert.alert('Flow no disponible', 'No se pudo localizar el flujo seleccionado en memoria.')
        return
      }

      // Enviar steps (camelCase) como string JSON en params
      const stepsParam = JSON.stringify(flow.steps)

      router.push({
        pathname: '/(app)/flow/[flowId]',
        params: {
          flowId: flow.flowId,
          title: flow.flowType,
          steps: stepsParam,
          projectId: projectId || '',
          facilityId: facilityId || '',
        },
      })
    },
    [facilityId, flows, projectId, router],
  )

  // Letras únicas disponibles (derivadas del backend)
  const availableLetters = useMemo<string[]>(
    () => getAvailableLetters(summaries, it => it.flowType),
    [summaries],
  )

  // Lista filtrada
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
