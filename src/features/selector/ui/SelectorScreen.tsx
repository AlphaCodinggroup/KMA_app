import { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { styles } from './styles/selector.styles'
import FlowList, { type FlowListItem } from './FlowList'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import Loader from '@shared/ui/loader/Loader'
import { filterItemsByLetter, getAvailableLetters, type LetterKey } from '@shared/lib/alphaFilter'
import LetterFilter from '@shared/ui/filters/LetterFilter'
import { useFlows } from '../application/useFlows'
import { EntityErrorState } from '@shared/ui/states/EntityErrorState'

const SelectorScreen: React.FC = () => {
  const router = useRouter()
  const { projectId, facilityId } = useLocalSearchParams<{
    projectId: string
    facilityId: string
  }>()
  const { items: flows, loading, error, refresh, refreshing } = useFlows()

  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  // Derivar resumen SOLO para la UI (no perdemos datos del flow completo)
  const summaries: FlowSummary[] = useMemo(
    () =>
      flows.map(f => {
        const description = f.description ?? ''
        const rawFlowType = f.flowType ?? ''
        const normalizedFlowType =
          typeof rawFlowType === 'string' && rawFlowType.trim().length > 0 ? rawFlowType : f.title

        return {
          id: f.flowId,
          title: f.title,
          version: String(f.version),
          description,
          stepsCount: f.steps.length,
          flowType: normalizedFlowType,
          isActive: f.isActive ?? true,
          createdAt: f.createdAt ?? '',
          updatedAt: f.updatedAt ?? '',
        }
      }),
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
          title: flow.title,
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
    () => getAvailableLetters(summaries, it => it.title),
    [summaries],
  )

  // Lista filtrada por letra
  const filteredItems = useMemo<FlowSummary[]>(
    () => filterItemsByLetter(summaries, selectedLetter, it => it.title),
    [summaries, selectedLetter],
  )

  if (loading) return <Loader loading={loading} />

  // Error sin ningún dato disponible (ni remoto ni cache)
  if (!loading && error && flows.length === 0) {
    return (
      <EntityErrorState
        title="Select a flow"
        message="There was a problem loading flows. Please check your connection and try again."
      />
    )
  }

  // Sin flows para mostrar (caso vacío real)
  if (!loading && flows.length === 0) return <Loader text="No flows to display." />

  return (
    <View style={styles.container}>
      <SubHeadline text="Select a flow" stylesText={styles.text} />
      <LetterFilter
        letters={availableLetters}
        selected={selectedLetter}
        onSelect={setSelectedLetter}
      />
      <FlowList
        items={filteredItems}
        onPressItem={onPressItem}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </View>
  )
}

export default SelectorScreen
