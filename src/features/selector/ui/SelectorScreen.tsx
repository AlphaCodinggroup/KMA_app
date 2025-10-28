import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { FlowSummary } from '@entities/flow/model'
import { loadCatalog, coldSyncAllFlows } from '@features/selector/application/usecases'
import { styles } from './styles/selector.styles'
import FlowList from './FlowList'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import LetterFilter from './LetterFilter'
import { getKeyLetter, type LetterKey } from '../lib/getKeyLetter'

const SelectorScreen: React.FC = () => {
  const router = useRouter()
  const [items, setItems] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedLetter, setSelectedLetter] = useState<LetterKey>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Sincroniza automáticamente al ingresar
      await coldSyncAllFlows()
      const data = await loadCatalog()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onPressItem = useCallback(
    (item: FlowSummary) => {
      // Navegación al flujo
      router.push({
        pathname: '/(app)/flow/[flowId]',
        params: { flowId: item.id, title: item.title },
      })
    },
    [router],
  )

  // Letras únicas disponibles (derivadas del backend, no cambiamos el mock)
  const availableLetters = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const it of items) set.add(getKeyLetter(it))
    return Array.from(set).filter(Boolean).sort()
  }, [items])

  // Lista filtrada
  const filteredItems = useMemo<FlowSummary[]>(() => {
    if (selectedLetter === 'ALL') return items
    return items.filter(it => getKeyLetter(it) === selectedLetter)
  }, [items, selectedLetter])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SubHeadline text="Select a flow for your audit" stylesText={styles.text} />
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
