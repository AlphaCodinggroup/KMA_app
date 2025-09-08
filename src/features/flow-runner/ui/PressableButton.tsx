import { Text, View } from 'react-native'
import { styles } from './styles/pressableButton.styles'

type Props = { label: string; onPress: () => void }

const PressableButton: React.FC<Props> = ({ label, onPress }) => {
  return (
    <View
      style={styles.finishBtnWrapper}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text onPress={onPress} style={styles.finishBtnText}>
        {label}
      </Text>
    </View>
  )
}

export default PressableButton
