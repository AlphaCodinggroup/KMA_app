import Constants from 'expo-constants'

function fromExtra<T = any>(key: string, fallback?: T) {
  // @ts-expect-error: expoConfig puede ser undefined en producción
  return (Constants.expoConfig?.extra?.[key] as T | undefined) ?? fallback
}

export const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL ??
  fromExtra<string>('BACKEND_BASE_URL', 'https://example.com')

export const AUTH_SCHEME =
  process.env.EXPO_PUBLIC_AUTH_SCHEME ?? fromExtra<string>('AUTH_SCHEME', 'Bearer')

export const SYNC_BATCH_SIZE = Number(
  process.env.EXPO_PUBLIC_SYNC_BATCH_SIZE ?? fromExtra<number>('SYNC_BATCH_SIZE', 10),
)

export const RETRY_MAX_ATTEMPTS = Number(
  process.env.EXPO_PUBLIC_RETRY_MAX_ATTEMPTS ?? fromExtra<number>('RETRY_MAX_ATTEMPTS', 3),
)

export const RETRY_BASE_DELAY_MS = Number(
  process.env.EXPO_PUBLIC_RETRY_BASE_DELAY_MS ?? fromExtra<number>('RETRY_BASE_DELAY_MS', 600),
)
