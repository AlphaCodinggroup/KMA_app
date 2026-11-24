import React, { memo, useCallback } from 'react'
import { Text, View } from 'react-native'
import EntityList from '@shared/ui/list/EntityList'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import type { CompletedAudit } from '@entities/audit/model'
import { auditBadge, canEditAudit, formatAuditDate, type AuditBadgeTone } from '../lib/presentation'
import { styles } from './styles/completedAudits.styles'

export interface CompletedAuditsListProps {
  items: ReadonlyArray<CompletedAudit>
  refreshing?: boolean
  onRefresh?: () => void
  /** Si no viene no se muestra el botón Edit. */
  onEdit?: (audit: CompletedAudit) => void
  /** Reintenta una edición que no se pudo enviar. */
  onRetry?: (audit: CompletedAudit) => void
}

const BADGE_STYLE: Record<AuditBadgeTone, object> = {
  success: styles.badgeSuccess,
  info: styles.badgeInfo,
  warning: styles.badgeWarning,
  error: styles.badgeError,
  neutral: styles.badgeNeutral,
}

const BADGE_TEXT_STYLE: Record<AuditBadgeTone, object> = {
  success: styles.badgeTextSuccess,
  info: styles.badgeTextInfo,
  warning: styles.badgeTextWarning,
  error: styles.badgeTextError,
  neutral: styles.badgeTextNeutral,
}

const CompletedAuditCard: React.FC<{
  audit: CompletedAudit
  onEdit?: (audit: CompletedAudit) => void
  onRetry?: (audit: CompletedAudit) => void
}> = memo(({ audit, onEdit, onRetry }) => {
  const badge = auditBadge(audit)
  const submitted = formatAuditDate(audit.createdAt)
  const edited = formatAuditDate(audit.editedAt)

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{audit.flowName}</Text>
      {submitted ? <Text style={styles.meta}>Submitted {submitted}</Text> : null}
      {edited ? <Text style={styles.meta}>Edited on {edited}</Text> : null}

      <View style={styles.footer}>
        <View style={[styles.badge, BADGE_STYLE[badge.tone]]}>
          <Text style={[styles.badgeText, BADGE_TEXT_STYLE[badge.tone]]}>{badge.label}</Text>
        </View>

        {onRetry && audit.syncState === 'failed' && !audit.localSubmissionId ? (
          <PrimaryButton
            label="Retry"
            size="sm"
            variant="outline"
            onPress={() => onRetry(audit)}
            contentStyle={styles.editButton}
            accessibilityLabel={`Retry sending ${audit.flowName}`}
          />
        ) : null}

        {onEdit && canEditAudit(audit) ? (
          <PrimaryButton
            label="Edit"
            size="sm"
            variant="outline"
            onPress={() => onEdit(audit)}
            contentStyle={styles.editButton}
            accessibilityLabel={`Edit ${audit.flowName}`}
          />
        ) : null}
      </View>
    </View>
  )
})
CompletedAuditCard.displayName = 'CompletedAuditCard'

const CompletedAuditsList: React.FC<CompletedAuditsListProps> = ({
  items,
  refreshing = false,
  onRefresh,
  onEdit,
  onRetry,
}) => {
  const keyExtractor = useCallback((item: CompletedAudit) => item.id, [])
  const renderItem = useCallback(
    (item: CompletedAudit) => (
      <CompletedAuditCard
        audit={item}
        {...(onEdit ? { onEdit } : {})}
        {...(onRetry ? { onRetry } : {})}
      />
    ),
    [onEdit, onRetry],
  )

  return (
    <EntityList<CompletedAudit>
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={refreshing}
      {...(onRefresh ? { onRefresh } : {})}
      contentContainerStyle={styles.listContent}
      itemSpacing={12}
    />
  )
}

export default memo(CompletedAuditsList)
