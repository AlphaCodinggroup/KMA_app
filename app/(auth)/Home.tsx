import { useEffect, useState } from 'react'
import { View, Text, Button, ScrollView } from 'react-native'
import {
  loadCatalog,
  downloadFlow,
  coldSyncAllFlows,
} from '@features/selector/application/usecases'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Home() {
  const [catalog, setCatalog] = useState<{
    flows: Array<{ id: string; title: string; version: string; stepsCount?: number }>
  }>({ flows: [] })
  const [lastDetail, setLastDetail] = useState<{ flowId: string; steps?: any[] } | null>(null)
  const [status, setStatus] = useState('Idle')

  useEffect(() => {
    ;(async () => {
      setStatus('Cargando catálogo local/remoto…')
      const cat = await loadCatalog()
      setCatalog(cat)
      setStatus(`Catálogo listo (${cat.flows.length})`)
    })()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>Dev / Verificación API & SQLite</Text>
        <Text>{status}</Text>

        <Button
          title="Cold Sync (/flows/all)"
          onPress={async () => {
            setStatus('Sincronizando en frío…')
            const res = await coldSyncAllFlows()
            setStatus(`Sincronización OK. Flows: ${res.count}`)
            const cat = await loadCatalog()
            setCatalog(cat)
          }}
        />

        {catalog.flows.map(f => (
          <View key={f.id} style={{ padding: 8, borderWidth: 1, borderRadius: 8 }}>
            <Text style={{ fontWeight: '600' }}>
              {f.title} — {f.version}
            </Text>
            <Text>
              ID: {f.id} | stepsCount: {f.stepsCount ?? 'n/d'}
            </Text>
            <Button
              title="Descargar detalle (/flows/{id})"
              onPress={async () => {
                setStatus(`Descargando ${f.id}…`)
                const detail = await downloadFlow(f.id)
                setLastDetail(detail)
                setStatus(`Detalle ${detail.flowId} con ${detail.steps.length} steps`)
              }}
            />
          </View>
        ))}

        {lastDetail && (
          <View style={{ padding: 8, borderWidth: 1, borderRadius: 8 }}>
            <Text style={{ fontWeight: '600' }}>Último detalle</Text>
            <Text>
              {lastDetail.flowId} — steps: {lastDetail.steps?.length}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
