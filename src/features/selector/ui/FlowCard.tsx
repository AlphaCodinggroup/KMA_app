import { View, Text, TouchableOpacity } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { styles } from './styles/flowCard.styles'

type Props = {
  item: FlowSummary
  onPress?: (item: FlowSummary) => void
  testID?: string
}

const FlowCard: React.FC<Props> = ({ item, onPress, testID }) => {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={() => onPress?.(item)}
      style={styles.card}
      activeOpacity={0.88}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
      </View>

      {!!item.description && (
        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {item.stepsCount ? `${item.stepsCount} pasos` : '—'} · {item.version}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default FlowCard
