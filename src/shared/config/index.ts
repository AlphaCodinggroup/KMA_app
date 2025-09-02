/**
 * @file Capa de configuración de la app.
 * Lee valores de `extra` definidos en `app.json/app.config.{ts,js}` vía `expo-constants`
 * y los expone como un objeto `CONFIG` de solo lectura.
 */

import Constants from 'expo-constants'

/**
 * Tipo esperado para el bloque `extra` proveniente de la configuración de Expo.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  BACKEND_BASE_URL: string
  AUTH_SCHEME: string
  SYNC_BATCH_SIZE: number
  RETRY_MAX_ATTEMPTS: number
  RETRY_BASE_DELAY_MS: number
}

/**
 * Objeto de configuración de solo lectura utilizado en toda la aplicación.
 * Todos los valores provienen de `expo-constants` → `expoConfig.extra`.
 */
export const CONFIG = {
  BACKEND_BASE_URL: extra.BACKEND_BASE_URL,
  AUTH_SCHEME: extra.AUTH_SCHEME,
  SYNC_BATCH_SIZE: extra.SYNC_BATCH_SIZE,
  RETRY_MAX_ATTEMPTS: extra.RETRY_MAX_ATTEMPTS,
  RETRY_BASE_DELAY_MS: extra.RETRY_BASE_DELAY_MS,
} as const
