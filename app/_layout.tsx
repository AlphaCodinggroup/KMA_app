import { useEffect } from 'react'
import { bootstrapApp } from '@processes/bootstrap'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  useEffect(() => {
    bootstrapApp().catch(e => {
      console.error('Bootstrap failed:', e)
    })
  }, [])
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
