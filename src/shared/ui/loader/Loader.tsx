import { ActivityIndicator, Text, View } from 'react-native'
import { styles } from './styles/loader.styles'
import PrimaryButton from '../buttons/PrimaryButton'

type LoaderProps = {
  loading?: boolean
  text?: string
  refresh?: () => void
}

const Loader: React.FC<LoaderProps> = ({ loading = false, text = '', refresh }) => {
  return (
    <View style={styles.loadingContainer}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <View>
          <Text style={styles.notContent}>{text}</Text>
          {refresh && (
            <PrimaryButton label="Reload" size="sm" onPress={refresh} loading={loading} />
          )}
        </View>
      )}
    </View>
  )
}

export default Loader
