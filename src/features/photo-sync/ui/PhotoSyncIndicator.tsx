import React from 'react'
import { Text, View } from 'react-native'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import { usePhotoSyncStatus } from '../application/usePhotoSyncStatus'
import { useLowStorage } from '../application/useLowStorage'
import { styles } from './styles/photoSync.styles'

/**
 * Indicador global (Profile): fotos de auditorías V2 que todavía no se respaldaron.
 * No renderiza nada cuando todo está sincronizado.
 */
export const PhotoSyncIndicator: React.FC = () => {
  const { counts, online, retrying, retry } = usePhotoSyncStatus()
  const lowStorage = useLowStorage()

  if (counts.unsynced === 0) return null

  const noun = counts.unsynced === 1 ? 'photo' : 'photos'

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>
        {counts.unsynced} {noun} pending backup
      </Text>
      <Text style={styles.summary}>
        {counts.failed > 0
          ? `${counts.failed} failed to sync.`
          : online
            ? 'They will sync automatically.'
            : 'You are offline. They will sync when the connection is back.'}
      </Text>

      {lowStorage ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Low storage: free up space so photos can be saved until they are backed up.
          </Text>
        </View>
      ) : null}

      <PrimaryButton
        label={retrying ? 'Retrying...' : 'Retry sync'}
        onPress={retry}
        disabled={retrying}
        size="sm"
        fullWidth
        contentStyle={styles.button}
        accessibilityLabel="Retry photo sync"
      />
    </View>
  )
}
