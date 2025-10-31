import React, { type PropsWithChildren, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { getSnapshot, getValidToken, subscribe } from '@shared/session/session'

const AuthGuard: React.FC<PropsWithChildren> = ({ children }) => {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      try {
        await getValidToken()
        if (!cancelled) setHasSession(true)
      } catch {
        if (!cancelled) setHasSession(false)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    const snap = getSnapshot()
    if (snap.idToken) {
      setHasSession(true)
      setReady(true)
    } else {
      bootstrap()
    }

    const unsub = subscribe(e => {
      if (e.type === 'logout') {
        setHasSession(false)
      }
      if (e.type === 'login' || e.type === 'refresh') {
        setHasSession(!!e.snapshot.idToken)
      }
    })

    return () => {
      cancelled = true
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
