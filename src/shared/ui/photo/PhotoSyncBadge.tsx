import React, { memo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppColors } from '../colors'

/**
 * Estado visible de una foto respecto del backup:
 * - uploaded: respaldada en el servidor.
 * - uploading: subiéndose ahora.
 * - waiting: en cola, hay red (sube en cuanto le toque).
 * - offline: en cola, sin red.
 * - failed: la subida falló; necesita "Retry sync".
 */
export type PhotoBadgeStatus = 'uploaded' | 'uploading' | 'waiting' | 'offline' | 'failed'

const LABELS: Record<PhotoBadgeStatus, string> = {
  uploaded: 'Backed up',
  uploading: 'Syncing',
  waiting: 'Waiting to sync',
  offline: 'Pending (offline)',
  failed: 'Sync failed',
}

export const photoBadgeLabel = (status: PhotoBadgeStatus): string => LABELS[status]

const ICONS = {
  uploaded: { name: 'cloud-done', color: '#15803D' },
  waiting: { name: 'cloud-upload-outline', color: AppColors.MutedText },
  offline: { name: 'cloud-offline-outline', color: AppColors.MutedText },
  failed: { name: 'warning', color: AppColors.Error },
} as const

type Props = { status: PhotoBadgeStatus; size?: number; testID?: string }

const PhotoSyncBadgeBase: React.FC<Props> = ({ status, size = 16, testID }) => (
  <View
    style={styles.badge}
    accessible
    accessibilityLabel={photoBadgeLabel(status)}
    testID={testID}
  >
    {status === 'uploading' ? (
      <ActivityIndicator size="small" color={AppColors.BorderBlue} />
    ) : (
      <Ionicons name={ICONS[status].name} size={size} color={ICONS[status].color} />
    )}
  </View>
)

const styles = StyleSheet.create({
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.Background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
  },
})

export default memo(PhotoSyncBadgeBase)
