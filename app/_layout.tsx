import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useBootstrap } from '@processes/boostrap'

export default function RootLayout() {
  useBootstrap()
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
