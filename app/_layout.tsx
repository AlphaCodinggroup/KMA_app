import 'react-native-gesture-handler'
import React, { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { bootstrapApp, cleanupBootstrap } from '@processes/bootstrap'
import AppToastProvider from '@shared/ui/toast/AppToast'

const RootLayout: React.FC = () => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await bootstrapApp()
      } finally {
        if (mounted) setReady(true)
      }
    })()

    return () => {
      mounted = false
      cleanupBootstrap()
    }
  }, [])

  if (!ready) return null

  return (
    <GestureHandlerRootView>
      <AppToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AppToastProvider>
    </GestureHandlerRootView>
  )
}

export default RootLayout
