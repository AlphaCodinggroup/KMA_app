import { z } from 'zod'
import Constants from 'expo-constants'

function readEnv(key: string): string | undefined {
  const fromProcess = process.env?.[key]
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess
  const extra = Constants?.expoConfig?.extra || {}
  if (typeof extra[key] === 'string' && extra[key].length > 0) return extra[key]
  return undefined
}

// Esquema tipado de configuración pública
const EnvSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
  EXPO_PUBLIC_COGNITO_BASE_URL: z
    .string()
    .url()
    .default('https://cognito-idp.us-east-2.amazonaws.com'),
  EXPO_PUBLIC_COGNITO_CLIENT_ID: z.string().min(5, 'CLIENT_ID inválido'),
  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().min(0).max(10))
    .default('3' as unknown as number) as unknown as z.ZodNumber,
  EXPO_PUBLIC_RETRY_BASE_DELAY_MS: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().min(100).max(30000))
    .default('800' as unknown as number) as unknown as z.ZodNumber,
  EXPO_PUBLIC_SYNC_BATCH_SIZE: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().min(1).max(100))
    .default('10' as unknown as number) as unknown as z.ZodNumber,
})

// Construye un diccionario con las claves esperadas
const raw: Record<string, string | undefined> = {
  EXPO_PUBLIC_API_BASE_URL: readEnv('EXPO_PUBLIC_API_BASE_URL'),
  EXPO_PUBLIC_COGNITO_BASE_URL: readEnv('EXPO_PUBLIC_COGNITO_BASE_URL'),
  EXPO_PUBLIC_COGNITO_CLIENT_ID: readEnv('EXPO_PUBLIC_COGNITO_CLIENT_ID'),
  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS: readEnv('EXPO_PUBLIC_RETRY_MAX_ATTEMPTS') ?? '3',
  EXPO_PUBLIC_RETRY_BASE_DELAY_MS: readEnv('EXPO_PUBLIC_RETRY_BASE_DELAY_MS') ?? '800',
  EXPO_PUBLIC_SYNC_BATCH_SIZE: readEnv('EXPO_PUBLIC_SYNC_BATCH_SIZE') ?? '10',
}

const parsed = EnvSchema.safeParse(raw)
if (!parsed.success) {
  const issues = parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(
    `\n[ENV] Configuración inválida. Revisá tu .env y/o extra en app.config.ts\n${issues}\n` +
      `Requeridos:\n` +
      `  EXPO_PUBLIC_API_BASE_URL (url del backend)\n` +
      `  EXPO_PUBLIC_COGNITO_CLIENT_ID (App Client de Cognito)\n` +
      `Opcionales/por defecto:\n` +
      `  EXPO_PUBLIC_COGNITO_BASE_URL (default us-east-2)\n` +
      `  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS (default 3)\n` +
      `  EXPO_PUBLIC_RETRY_BASE_DELAY_MS (default 800)\n` +
      `  EXPO_PUBLIC_SYNC_BATCH_SIZE (default 10)`,
  )
}

// Export público y tipado
export const Env = Object.freeze({
  apiBaseUrl: parsed.data.EXPO_PUBLIC_API_BASE_URL,
  cognito: {
    baseUrl: parsed.data.EXPO_PUBLIC_COGNITO_BASE_URL,
    clientId: parsed.data.EXPO_PUBLIC_COGNITO_CLIENT_ID,
  },
  retry: {
    maxAttempts: parsed.data.EXPO_PUBLIC_RETRY_MAX_ATTEMPTS as unknown as number,
    baseDelayMs: parsed.data.EXPO_PUBLIC_RETRY_BASE_DELAY_MS as unknown as number,
  },
  sync: {
    batchSize: parsed.data.EXPO_PUBLIC_SYNC_BATCH_SIZE as unknown as number,
  },
})

export type EnvType = typeof Env
