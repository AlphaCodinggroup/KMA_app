import React, { type PropsWithChildren, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { getSnapshot, subscribe } from '@shared/session/session'

const AuthGuard: React.FC<PropsWithChildren> = ({ children }) => {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Estado inicial: confiamos en lo que haya en memoria (initSession ya corrió en bootstrap)
    const snap = getSnapshot()
    setHasSession(!!snap.refreshToken)
    setReady(true)

    // Nos suscribimos a cambios de sesión:
    // - login → hay refreshToken
    // - refresh → seguimos teniendo refreshToken
    // - logout → se borra todo
    const unsub = subscribe(e => {
      if (e.type === 'logout') {
        setHasSession(false)
        return
      }

      if (e.type === 'login' || e.type === 'refresh' || e.type === 'change') {
        setHasSession(!!e.snapshot.refreshToken)
      }
    })

    return () => {
      unsub()
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!hasSession) {
      router.replace('/(auth)/login')
    }
  }, [ready, hasSession, router])

  if (!ready) return null
  if (!hasSession) return null

  return <>{children}</>
}

export default AuthGuard
