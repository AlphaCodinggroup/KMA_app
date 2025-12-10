import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import { getSnapshot, subscribe, type SessionSnapshot } from '@shared/session/session'
import { logoutUseCase } from '@features/auth/application/logout'
import { decodeJwtPayload, type JwtClaims } from '@shared/lib/jwt'
import { styles } from './styles/profile.styles'

export const ProfileScreen: React.FC = () => {
  const router = useRouter()

  const [session, setSession] = useState<SessionSnapshot>(() => getSnapshot())
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe(event => {
      if (event.type === 'login' || event.type === 'refresh' || event.type === 'change') {
        setSession(event.snapshot)
      }
      if (event.type === 'logout') {
        setSession({ idToken: null, refreshToken: null, expiresAt: null })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const claims = useMemo<JwtClaims>(() => decodeJwtPayload(session.idToken), [session.idToken])
  const displayName = useMemo(() => {
    if (!session.idToken) return 'No active session'
    return (
      claims?.name ??
      claims?.username ??
      claims?.['cognito:username'] ??
      claims?.email ??
      'Unknown user'
    )
  }, [claims, session.idToken])

  const displayRole = useMemo(() => {
    if (!session.idToken) return 'No role'
    const groups = Array.isArray(claims?.['cognito:groups']) ? claims?.['cognito:groups'] : []
    return (
      claims?.role ??
      claims?.['custom:role'] ??
      (groups.length > 0 ? groups[0] : null) ??
      'No role'
    )
  }, [claims, session.idToken])

  const handleLogout = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    setError(null)
    try {
      await logoutUseCase()
      router.replace('/(auth)/login')
    } catch {
      setError('Could not sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }, [router, signingOut])

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{displayName}</Text>

        <Text style={[styles.label, styles.sectionSpacing]}>Role</Text>
        <Text style={styles.value}>{displayRole}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={signingOut ? 'Signing out...' : 'Sign out'}
        onPress={handleLogout}
        disabled={signingOut}
        fullWidth
        contentStyle={styles.button}
        accessibilityLabel="Sign out"
      />
    </View>
  )
}
