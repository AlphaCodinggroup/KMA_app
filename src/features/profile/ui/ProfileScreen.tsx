import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import PrimaryButton from '@shared/ui/buttons/PrimaryButton'
import {
  getCurrentUserId,
  getSnapshot,
  subscribe,
  type SessionSnapshot,
} from '@shared/session/session'
import { sqliteOutboxRepo } from '@core/repos/sqliteOutboxRepo'
import { logoutUseCase } from '@features/auth/application/logout'
import { decodeJwtPayload, type JwtClaims } from '@shared/lib/jwt'
import { FailedAuditsSection } from '@features/failed-audits'
import { PhotoSyncIndicator } from '@features/photo-sync'
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
        setSession(getSnapshot())
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
      claims?.role ?? claims?.['custom:role'] ?? (groups.length > 0 ? groups[0] : null) ?? 'No role'
    )
  }, [claims, session.idToken])

  const performLogout = useCallback(async () => {
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
  }, [router])

  const handleLogout = useCallback(async () => {
    if (signingOut) return

    // Con auditorías pendientes avisamos: se envían la próxima vez que el mismo usuario inicie sesión.
    let pending = 0
    try {
      const userId = getCurrentUserId()
      pending = userId ? await sqliteOutboxRepo.countPending(userId) : 0
    } catch {
      pending = 0
    }

    if (pending === 0) {
      await performLogout()
      return
    }

    const noun = pending === 1 ? 'audit' : 'audits'
    Alert.alert(
      'Sign out',
      `You have ${pending} ${noun} pending sync. They will be sent the next time you log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void performLogout() },
      ],
    )
  }, [performLogout, signingOut])

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{displayName}</Text>

        <Text style={[styles.label, styles.sectionSpacing]}>Role</Text>
        <Text style={styles.value}>{displayRole}</Text>
      </View>

      <FailedAuditsSection />
      <PhotoSyncIndicator />

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
