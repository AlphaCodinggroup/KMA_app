import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { AppColors } from '@shared/ui/colors'
import type { FlowSummary } from '@entities/flow/model'
import { MockFlowCatalogRepo } from '@features/selector/data/flowCatalog.mock'
import { loadCatalog } from '@features/selector/application/usecases'
import { FlowList } from '@features/selector/ui/FlowList'

export default function SelectorScreen() {
  const [loading, setLoading] = useState(true)
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const repo = new MockFlowCatalogRepo()
        // const repo = new HttpFlowCatalogRepo(); //!CAMBIAR PARA QUITAR MOCK
        const data = await loadCatalog(repo)
        if (mounted) {
          setFlows(data)
          setError(null)
        }
      } catch (e) {
        if (mounted) setError('No se pudo cargar el catálogo.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const handleSelect = (item: FlowSummary) => {
    // Futuro: navegar al detalle del flow o al primer paso del flujo.
    // Por ahora, mostramos un toast/log
    console.log('Flow seleccionado:', item.id)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Selector de Flows</Text>
          <Text style={styles.subtitle}>Cargando...</Text>
        </View>
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Selector de Flows</Text>
          <Text style={styles.error}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Selector de Flows</Text>
        <Text style={styles.subtitle}>Elegí un flujo para continuar</Text>
      </View>
      <FlowList data={flows} onSelect={handleSelect} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.Surface },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: AppColors.Text },
  subtitle: { fontSize: 14, color: AppColors.Subtext, marginTop: 2 },
  error: { fontSize: 14, color: AppColors.Error, marginTop: 6 },
})
