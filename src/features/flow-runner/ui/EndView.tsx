import type { EndStep } from '@shared/validation/steps.schema'
import { Text, View } from 'react-native'
import PressableButton from './PressableButton'
import { styles } from './styles/endView.styles'

type Props = { step: EndStep; onFinish: () => void }

const EndView: React.FC<Props> = ({ step, onFinish }) => {
  return (
    <View style={styles.content}>
      <Text style={styles.endMessage}>{step.message}</Text>
      <PressableButton label="Back to selector" onPress={onFinish} />
    </View>
  )
}

export default EndView
