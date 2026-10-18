import React, { useMemo } from 'react'
import { Text, View } from 'react-native'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import PhotoSyncBadge from '@shared/ui/photo/PhotoSyncBadge'
import { Env } from '@shared/config/env'
import { usePhotoSyncStatus } from '../application/usePhotoSyncStatus'
import { badgeOf, countPhotos, worstBadge } from '../application/photoSyncState'
import { useLowStorage } from '../application/useLowStorage'
import { styles } from './styles/photoSync.styles'

type Props = {
  submissionId: string
  /** Título legible de un paso; si no se conoce se muestra el id. */
  stepTitleOf?: (stepId: string) => string | undefined
}

/**
 * "Photo evidence": estado del backup de las fotos de la auditoría en curso, agrupado por paso.
 * No renderiza nada si la auditoría no tiene fotos en el ciclo V2 (sin ruido).
 */
export const PhotoEvidenceSection: React.FC<Props> = ({ submissionId, stepTitleOf }) => {
  const { photos, counts, online, retrying, retry } = usePhotoSyncStatus(submissionId)
  const lowStorage = useLowStorage()

  const bySteps = useMemo(() => {
    const groups = new Map<string, typeof photos>()
    for (const p of photos) groups.set(p.stepId, [...(groups.get(p.stepId) ?? []), p])
    return Array.from(groups.entries()).map(([stepId, list]) => ({
      stepId,
      total: list.length,
      uploaded: countPhotos(list).uploaded,
      status: worstBadge(list.map(p => badgeOf(p, online))),
    }))
  }, [online, photos])

  if (counts.total === 0) return null

  // "Retry sync" sólo cuando hay algo que empujar: fallas, o cola con la subida automática activa
  const showRetry = counts.failed > 0 || (counts.unsynced > 0 && Env.flags.photoBackgroundUpload)

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Photo evidence</Text>
      <Text style={styles.summary}>
        {counts.uploaded} of {counts.total} backed up
      </Text>

      {Env.flags.photoBackgroundUpload ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Automatic backup enabled</Text>
        </View>
      ) : null}

      {lowStorage && counts.unsynced > 0 ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Low storage: free up space so photos can be saved until they are backed up.
          </Text>
        </View>
      ) : null}

      {bySteps.map(step => (
        <View key={step.stepId} style={styles.row}>
          <PhotoSyncBadge status={step.status} />
          <Text style={styles.rowTitle} numberOfLines={1}>
            {stepTitleOf?.(step.stepId) ?? step.stepId}
          </Text>
          <Text style={styles.rowCount}>
            {step.uploaded}/{step.total}
          </Text>
        </View>
      ))}

      {showRetry ? (
        <PrimaryButton
          label={retrying ? 'Retrying...' : 'Retry sync'}
          onPress={retry}
          disabled={retrying}
          size="sm"
          fullWidth
          contentStyle={styles.button}
          accessibilityLabel="Retry photo sync"
        />
      ) : null}
    </View>
  )
}
