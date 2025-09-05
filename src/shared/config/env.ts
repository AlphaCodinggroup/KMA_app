export const ENV = {
  BACKEND_BASE_URL: process.env.EXPO_PUBLIC_BASE_URL ?? 'http://localhost:3001',
  AUTH_SCHEME: process.env.EXPO_PUBLIC_AUTH_SCHEME ?? 'Bearer',
  RETRY_MAX_ATTEMPTS: Number(process.env.EXPO_PUBLIC_RETRY_MAX_ATTEMPTS ?? 3),
  RETRY_BASE_DELAY_MS: Number(process.env.EXPO_PUBLIC_RETRY_BASE_DELAY_MS ?? 400),
  AUTH_REFRESH_PATH: process.env.EXPO_PUBLIC_AUTH_REFRESH_PATH ?? '/auth/refresh',
} as const
