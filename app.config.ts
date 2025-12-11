import type { ExpoConfig, ConfigContext } from '@expo/config'
import 'dotenv/config'
import { z } from 'zod'

const BuildEnvSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url({ message: 'URL inválida para API BASE' }),
  EXPO_PUBLIC_COGNITO_BASE_URL: z
    .string()
    .url()
    .default('https://cognito-idp.us-east-2.amazonaws.com'),
  EXPO_PUBLIC_COGNITO_CLIENT_ID: z.string().min(5, 'CLIENT_ID inválido'),
  EXPO_PUBLIC_RETRY_MAX_ATTEMPTS: z.string().optional(),
  EXPO_PUBLIC_RETRY_BASE_DELAY_MS: z.string().optional(),
  EXPO_PUBLIC_SYNC_BATCH_SIZE: z.string().optional(),
  EAS_PROJECT_ID: z.string().optional(),
})

export default ({ config }: ConfigContext): ExpoConfig => {
  const parsed = BuildEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('')
    throw new Error(`[ENV] Variables de build inválidas en .env${issues}`)
  }

  const env = parsed.data

  return {
    ...config,

    name: 'KMA_app',
    slug: 'kma_app',
    scheme: 'kma',
    version: '1.0.5',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    runtimeVersion: { policy: 'sdkVersion' },

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    updates: {
      enabled: true,
      checkAutomatically: 'ON_ERROR_RECOVERY',
    },

    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-secure-store',
      'expo-file-system',
      'expo-camera',
      'expo-task-manager',
      'expo-background-task',
    ],

    ios: {
      bundleIdentifier: 'com.kma.app',
      buildNumber: '2',
      supportsTablet: true,
      requireFullScreen: false,
      infoPlist: {
        NSCameraUsageDescription: 'We need the camera to capture photos on forms.',
        NSPhotoLibraryUsageDescription: 'We need access to your photos to attach them to forms.',
        NSPhotoLibraryAddUsageDescription: 'We save photos captured by the app to your gallery.',
        UIBackgroundModes: ['fetch', 'processing'],
        BGTaskSchedulerPermittedIdentifiers: ['com.kma.app.sync'],
      },
    },

    android: {
      package: 'com.kma.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['INTERNET', 'ACCESS_NETWORK_STATE', 'CAMERA', 'READ_MEDIA_IMAGES'],
      edgeToEdgeEnabled: true,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    extra: {
      ...(config.extra || {}),
      EXPO_PUBLIC_API_BASE_URL: env.EXPO_PUBLIC_API_BASE_URL,
      EXPO_PUBLIC_COGNITO_BASE_URL:
        env.EXPO_PUBLIC_COGNITO_BASE_URL ?? 'https://cognito-idp.us-east-2.amazonaws.com',
      EXPO_PUBLIC_COGNITO_CLIENT_ID: env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
      EXPO_PUBLIC_RETRY_MAX_ATTEMPTS: env.EXPO_PUBLIC_RETRY_MAX_ATTEMPTS ?? '3',
      EXPO_PUBLIC_RETRY_BASE_DELAY_MS: env.EXPO_PUBLIC_RETRY_BASE_DELAY_MS ?? '600',
      EXPO_PUBLIC_SYNC_BATCH_SIZE: env.EXPO_PUBLIC_SYNC_BATCH_SIZE ?? '10',
      eas: {
        ...config.extra?.eas,
        projectId: env.EAS_PROJECT_ID || '1b6bf518-a922-462a-814e-460280053abf',
      },
    },

    experiments: {
      typedRoutes: true,
    },
  }
}
