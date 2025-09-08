import { FlatList, View } from 'react-native'
import type { FlowSummary } from '@entities/flow/model'
import { styles } from './styles/flowList.styles'
import { useCallback } from 'react'
import FlowCard from './FlowCard'

type Props = {
  data: FlowSummary[]
  onPressItem?: (item: FlowSummary) => void
  testID?: string
}

const FlowList: React.FC<Props> = ({ data, onPressItem, testID }) => {
  const itemSeparatorComponent = useCallback(() => <View style={styles.separator} />, [])

  const renderItem = useCallback(
    ({ item }: { item: FlowSummary }) => {
      return onPressItem ? <FlowCard item={item} onPress={onPressItem} /> : <FlowCard item={item} />
    },
    [onPressItem],
  )

  return (
    <FlatList
      testID={testID}
      data={data}
      keyExtractor={it => it.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={itemSeparatorComponent}
      renderItem={renderItem}
    />
  )
}
export default FlowList
