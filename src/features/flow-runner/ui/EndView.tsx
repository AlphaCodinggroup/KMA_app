import { Text, View } from 'react-native'
import { styles } from './styles/endView.styles'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'

type Props = { onFinish: () => void; loading: boolean; label?: string }

const EndView: React.FC<Props> = ({ onFinish, loading, label = 'Save audit' }) => {
  return (
    <View style={styles.content}>
      <Text style={styles.endMessage}>Thank you for completing the flow!</Text>
      <PrimaryButton label={label} size="sm" onPress={onFinish} loading={loading} />
    </View>
  )
}

export default EndView
