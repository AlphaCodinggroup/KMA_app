import { ActivityIndicator, Text, View } from 'react-native'
import { styles } from './styles/loader.styles'

type LoaderProps = {
  loading?: boolean
  text?: string
}

const Loader: React.FC<LoaderProps> = ({ loading, text = '' }) => {
  return (
    <View style={styles.loadingContainer}>
      {loading ? <ActivityIndicator size="large" /> : <Text style={styles.notContent}>{text}</Text>}
    </View>
  )
}

export default Loader
