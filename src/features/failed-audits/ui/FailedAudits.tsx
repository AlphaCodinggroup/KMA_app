import React from 'react'
import { Text, View } from 'react-native'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import { useFailedAudits } from '../application/useFailedAudits'
import { styles } from './styles/failedAudits.styles'

function headingFor(count: number): string {
  return `${count} ${count === 1 ? 'audit' : 'audits'} could not be synced`
}

/** Banner compacto (Selector): resumen + "Retry all". No renderiza nada sin fallidas. */
export const FailedAuditsBanner: React.FC = () => {
  const { items, retrying, retryAll } = useFailedAudits()
  if (items.length === 0) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.heading}>{headingFor(items.length)}</Text>
      <Text style={styles.message}>{items[0]?.message}</Text>
      <PrimaryButton
        label={retrying ? 'Retrying...' : 'Retry all'}
        onPress={retryAll}
        disabled={retrying}
        size="sm"
        fullWidth
        contentStyle={styles.button}
        accessibilityLabel="Retry all failed audits"
      />
    </View>
  )
}

/** Sección detallada (Profile): una tarjeta por auditoría con su mensaje y "Retry". */
export const FailedAuditsSection: React.FC = () => {
  const { items, retrying, retry } = useFailedAudits()
  if (items.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{headingFor(items.length)}</Text>
      {items.map(item => (
        <View key={item.submissionId} style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <PrimaryButton
            label="Retry"
            onPress={() => retry(item.submissionId)}
            disabled={retrying}
            size="sm"
            fullWidth
            contentStyle={styles.button}
            accessibilityLabel={`Retry ${item.title}`}
          />
        </View>
      ))}
    </View>
  )
}
