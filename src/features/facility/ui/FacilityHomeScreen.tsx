import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import { sqliteFacilityRepo } from '@core/repos/sqliteFacilityRepo'
import { useCompletedAudits } from '@features/audits'
import { FailedAuditsBanner } from '@features/failed-audits'
import { styles } from './styles/facility-home.styles'

/**
 * Home de una facility: elegir entre iniciar una auditoría nueva (flujo de siempre) o
 * revisar las completadas. El nombre llega por params; si falta (deep-link) se lee de la cache.
 */
const FacilityHomeScreen: React.FC = () => {
  const router = useRouter()
  const { facilityId, projectId, facilityName } = useLocalSearchParams<{
    facilityId: string
    projectId?: string
    facilityName?: string
  }>()

  const [cachedName, setCachedName] = useState<string>('')
  const name = facilityName || cachedName

  useEffect(() => {
    if (facilityName || !facilityId) return
    let active = true
    sqliteFacilityRepo
      .getById(facilityId)
      .then(f => active && setCachedName(f?.name ?? ''))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [facilityId, facilityName])

  const { items } = useCompletedAudits(facilityId)

  const startNewAudit = useCallback(() => {
    // Mismos params que antes de existir esta pantalla
    router.push({
      pathname: '/(app)/selector',
      params: { facilityId, projectId: projectId ?? '' },
    })
  }, [router, facilityId, projectId])

  const reviewCompleted = useCallback(() => {
    router.push({
      pathname: '/(app)/completed',
      params: { facilityId, projectId: projectId ?? '', facilityName: name },
    })
  }, [router, facilityId, projectId, name])

  return (
    <View style={styles.container}>
      {name ? <Stack.Screen options={{ title: name }} /> : null}
      <FailedAuditsBanner />

      <View style={styles.content}>
        <Text style={styles.heading}>What do you want to do?</Text>

        <PrimaryButton
          label="Start new audit"
          size="lg"
          fullWidth
          onPress={startNewAudit}
          accessibilityLabel="Start new audit"
        />

        <PrimaryButton
          label={items.length > 0 ? `Review completed (${items.length})` : 'Review completed'}
          size="lg"
          variant="outline"
          fullWidth
          onPress={reviewCompleted}
          style={styles.secondary}
          accessibilityLabel="Review completed audits"
        />
      </View>
    </View>
  )
}

export default FacilityHomeScreen
