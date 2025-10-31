import { z } from 'zod'
import Constants from 'expo-constants'

/**
 * Lee una variable de entorno, primero desde process.env
 * y luego desde expo-constants (app.config.ts -> extra).
 *
 * No hace fallback automático a defaults acá; los defaults
 * los maneja el schema de Zod.
 */
function readEnv(key: string): string | undefined {
  const fromProcess = process.env?.[key]
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess

  const extra = Constants?.expoConfig?.extra ?? {}
  if (typeof extra[key] === 'string' && extra[key].length > 0) return extra[key]

  return undefined
}

/**
 * Schema estricto de configuración pública.
 */
const EnvSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url({ message: 'URL inválida para API_BASE_URL' }),

  EXPO_PUBLIC_COGNITO_BASE_URL: z
    .string()
    .url({ message: 'URL inválida para COGNITO_BASE_URL' })
    .default('https://cognito-idp.us-east-2.amazonaws.com'),

  EXPO_PUBLIC_COGNITO_REGION: z
    .string()
    .min(2, 'COGNITO_REGION inválida (muy corta)')
    .default('us-east-2'),

  EXPO_PUBLIC_COGNITO_CLIENT_ID: z.string().min(5, 'COGNITO_CLIENT_ID inválido'),

  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(0).max(10).default(3),

  EXPO_PUBLIC_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(100).max(30000).default(600),

  EXPO_PUBLIC_SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  EAS_PROJECT_ID: z.string().optional(),
})

/**
 * Construye el objeto "raw" que va a validar Zod.
 * Si algo viene undefined y el schema tiene .default(), Zod lo completa.
 */
const raw = {
  EXPO_PUBLIC_API_BASE_URL: readEnv('EXPO_PUBLIC_API_BASE_URL'),
  EXPO_PUBLIC_COGNITO_BASE_URL: readEnv('EXPO_PUBLIC_COGNITO_BASE_URL'),
  EXPO_PUBLIC_COGNITO_REGION: readEnv('EXPO_PUBLIC_COGNITO_REGION'),
  EXPO_PUBLIC_COGNITO_CLIENT_ID: readEnv('EXPO_PUBLIC_COGNITO_CLIENT_ID'),

  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS: readEnv('EXPO_PUBLIC_RETRY_MAX_ATTEMPTS'),
  EXPO_PUBLIC_RETRY_BASE_DELAY_MS: readEnv('EXPO_PUBLIC_RETRY_BASE_DELAY_MS'),
  EXPO_PUBLIC_SYNC_BATCH_SIZE: readEnv('EXPO_PUBLIC_SYNC_BATCH_SIZE'),

  EAS_PROJECT_ID: readEnv('EAS_PROJECT_ID'),
}

const parsed = EnvSchema.safeParse(raw)

if (!parsed.success) {
  const issues = parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n')

  throw new Error(
    `\n[ENV] Configuración inválida. Revisá tu .env y/o extra en app.config.ts\n` +
      `${issues}\n\n` +
      `Requeridos:\n` +
      `  EXPO_PUBLIC_API_BASE_URL        -> URL base del backend (debe terminar en /api/v1)\n` +
      `  EXPO_PUBLIC_COGNITO_CLIENT_ID   -> App Client de Cognito\n\n` +
      `Autenticación Cognito:\n` +
      `  EXPO_PUBLIC_COGNITO_BASE_URL    -> endpoint cognito-idp (default us-east-2)\n` +
      `  EXPO_PUBLIC_COGNITO_REGION      -> región ej. "us-east-2"\n\n` +
      `Red / resiliencia:\n` +
      `  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS  -> reintentos axios (default 3)\n` +
      `  EXPO_PUBLIC_RETRY_BASE_DELAY_MS -> backoff base ms (default 600)\n\n` +
      `Sync offline:\n` +
      `  EXPO_PUBLIC_SYNC_BATCH_SIZE     -> tamaño de batch para sync offline (default 10)\n\n` +
      `Build:\n` +
      `  EAS_PROJECT_ID                  -> usado por EAS (opcional en runtime)\n`,
  )
}

/**
 * Export tipado y congelado.
 */
export const Env = Object.freeze({
  apiBaseUrl: parsed.data.EXPO_PUBLIC_API_BASE_URL,
  cognito: {
    baseUrl: parsed.data.EXPO_PUBLIC_COGNITO_BASE_URL,
    region: parsed.data.EXPO_PUBLIC_COGNITO_REGION,
    clientId: parsed.data.EXPO_PUBLIC_COGNITO_CLIENT_ID,
  },
  retry: {
    maxAttempts: parsed.data.EXPO_PUBLIC_RETRY_MAX_ATTEMPTS,
    baseDelayMs: parsed.data.EXPO_PUBLIC_RETRY_BASE_DELAY_MS,
  },
  sync: {
    batchSize: parsed.data.EXPO_PUBLIC_SYNC_BATCH_SIZE,
  },
  eas: {
    projectId: parsed.data.EAS_PROJECT_ID ?? null,
  },
})

export type EnvType = typeof Env
