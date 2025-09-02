import { View, Text, Button, StyleSheet } from 'react-native'

export default function LoginScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>Login</Text>
      <Button title="Iniciar sesión" onPress={() => {}} />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
})
