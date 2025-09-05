import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { AppColors } from '@shared/ui/colors'

type Props = {
  item: FlowSummary
  onPress?: (item: FlowSummary) => void // <- opcional
  testID?: string
}

export function FlowCard({ item, onPress, testID }: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={() => onPress?.(item)}
      style={styles.card}
      activeOpacity={0.85}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
      <Text style={styles.cardMeta}>
        {item.stepsCount ?? 0} pasos · {item.version}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.Background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppColors.Primary },
  cardDesc: { marginTop: 4, color: AppColors.MutedText },
  cardMeta: { marginTop: 8, fontSize: 12, color: AppColors.MutedText },
})
