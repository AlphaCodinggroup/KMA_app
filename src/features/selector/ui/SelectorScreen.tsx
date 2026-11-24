import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Flow, FlowSummary } from '@entities/flow/model'
import { styles } from './styles/selector.styles'
import FlowList, { type FlowListItem } from './FlowList'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import Loader from '@shared/ui/loader/Loader'
import type { LetterKey } from '@shared/lib/alphaFilter'
import LetterFilter from '@shared/ui/filters/LetterFilter'
import {
  filterSectionsByLetter,
  getSectionLetters,
  groupFlowsByCategory,
} from '../lib/groupFlowsByCategory'
import { useFlows } from '../application/useFlows'
import { FailedAuditsBanner } from '@features/failed-audits'
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
        // Sin categoría queda vacío: el agrupador la manda a "Other"
        const rawFlowType = f.flowType
        const normalizedFlowType = typeof rawFlowType === 'string' ? rawFlowType.trim() : ''

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

  const sections = useMemo(() => groupFlowsByCategory(summaries), [summaries])

  // Letras = iniciales de categoría
  const availableLetters = useMemo<string[]>(() => getSectionLetters(sections), [sections])

  // Si tras un refresh la letra elegida ya no existe, se vuelve a "All" (evita lista vacía sin salida)
  const effectiveLetter: LetterKey = availableLetters.includes(selectedLetter)
    ? selectedLetter
    : 'ALL'

  // Resetear el estado también, para que la letra no se reaplique sola si la categoría vuelve
  useEffect(() => {
    if (selectedLetter !== effectiveLetter) setSelectedLetter('ALL')
  }, [selectedLetter, effectiveLetter])

  const filteredSections = useMemo(
    () => filterSectionsByLetter(sections, effectiveLetter),
    [sections, effectiveLetter],
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
      <FailedAuditsBanner />
      <SubHeadline text="Select a flow" stylesText={styles.text} />
      <LetterFilter
        letters={availableLetters}
        selected={effectiveLetter}
        onSelect={setSelectedLetter}
      />
      <FlowList
        sections={filteredSections}
        onPressItem={onPressItem}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </View>
  )
}

export default SelectorScreen
