import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { loadAllFlowsWithSteps, coldSyncAllFlows } from '@features/selector/application/usecases'
import { styles } from './styles/selector.styles'
import FlowList from './FlowList'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import LetterFilter from './LetterFilter'
import { getKeyLetter, type LetterKey } from '../lib/getKeyLetter'

const SelectorScreen: React.FC = () => {
  const router = useRouter()
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
        version: String(f.version),
        description: f.description,
        stepsCount: f.steps.length,
        flowType: f.flowType,
        isActive: f.isActive,
      })),
    [flows],
  )

  const onPressItem = useCallback(
    (item: FlowSummary) => {
      // Navegación actual: por ahora solo por id/título.
      // Más adelante pasaremos steps o flow completo por params.
      router.push({
        pathname: '/(app)/flow/[flowId]',
        params: { flowId: item.id, title: item.title },
      })
    },
    [router],
  )

  // Letras únicas disponibles (derivadas del backend)
  const availableLetters = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const it of summaries) set.add(getKeyLetter(it))
    return Array.from(set).filter(Boolean).sort()
  }, [summaries])

  // Lista filtrada
  const filteredItems = useMemo<FlowSummary[]>(() => {
    if (selectedLetter === 'ALL') return summaries
    return summaries.filter(it => getKeyLetter(it) === selectedLetter)
  }, [summaries, selectedLetter])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SubHeadline text="Select the flow to audit" stylesText={styles.text} />
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
