import type { EndStep } from '@shared/validation/steps.schema'
import { Text, View } from 'react-native'
import { styles } from './styles/endView.styles'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'

type Props = { step: EndStep; onFinish: () => void }

const EndView: React.FC<Props> = ({ step, onFinish }) => {
  return (
    <View style={styles.content}>
      <Text style={styles.endMessage}>{step.message}</Text>
      <PrimaryButton label="Back to selector" size="sm" onPress={onFinish} />
    </View>
  )
}

export default EndView
