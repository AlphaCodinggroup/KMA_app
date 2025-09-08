import { useCallback, useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { FlowSummary } from '@entities/flow/model'
import { loadCatalog, coldSyncAllFlows } from '@features/selector/application/usecases'
import { styles } from './styles/selector.styles'
import FlowList from './FlowList'

const SelectorScreen: React.FC = () => {
  const router = useRouter()
  const [items, setItems] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)

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
      } as any)
    },
    [router],
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlowList data={items} onPressItem={onPressItem} />
    </View>
  )
}

export default SelectorScreen
