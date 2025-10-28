import { Text, View } from 'react-native'
import { styles } from './styles/endView.styles'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'

type Props = { onFinish: () => void; loading: boolean }

const EndView: React.FC<Props> = ({ onFinish, loading }) => {
  return (
    <View style={styles.content}>
      <Text style={styles.endMessage}>Thank you for completing the flow!</Text>
      <PrimaryButton label="Save audit" size="sm" onPress={onFinish} loading={loading} />
    </View>
  )
}

export default EndView
