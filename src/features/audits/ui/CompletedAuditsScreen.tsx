import React, { useCallback } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import Loader from '@shared/ui/loader/Loader'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import type { CompletedAudit } from '@entities/audit/model'
import { useCompletedAudits } from '../application/useCompletedAudits'
import { retryAuditEdit } from '../application/usecases'
import CompletedAuditsList from './CompletedAuditsList'
import { styles } from './styles/completedAudits.styles'

const CompletedAuditsScreen: React.FC = () => {
  const router = useRouter()
  const { facilityId, projectId } = useLocalSearchParams<{
    facilityId?: string
    projectId?: string
  }>()
  const { items, loading, refreshing, refresh, reload } = useCompletedAudits(facilityId)

  const onEdit = useCallback(
    (audit: CompletedAudit) => {
      // Sin `steps`: el runner los carga por id (la versión del flow es la de la auditoría)
      router.push({
        pathname: '/(app)/flow/[flowId]',
        params: {
          flowId: audit.flowId,
          title: audit.flowName,
          version: String(audit.flowVersion ?? ''),
          mode: 'edit',
          auditId: audit.id,
          projectId: audit.projectId ?? projectId ?? '',
          facilityId: audit.facilityId ?? facilityId ?? '',
        },
      })
    },
    [router, projectId, facilityId],
  )

  const onRetry = useCallback(
    async (audit: CompletedAudit) => {
      await retryAuditEdit(audit.id)
      await reload()
    },
    [reload],
  )

  if (loading && items.length === 0) return <Loader loading={true} />

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No completed audits for this facility.</Text>
        <PrimaryButton
          label="Reload"
          size="md"
          onPress={refresh}
          loading={refreshing}
          contentStyle={styles.emptyButton}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SubHeadline text="Completed audits" stylesText={styles.headline} />
      <CompletedAuditsList
        items={items}
        refreshing={refreshing}
        onRefresh={refresh}
        onEdit={onEdit}
        onRetry={onRetry}
      />
    </View>
  )
}

export default CompletedAuditsScreen
