import type { ExpoConfig, ConfigContext } from '@expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: 'KMA_app',
  slug: 'kma_app',
  scheme: 'kma',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

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
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Necesitamos la cámara para capturar fotos en formularios.',
      NSPhotoLibraryUsageDescription:
        'Necesitamos acceder a tus fotos para adjuntarlas en formularios.',
      NSPhotoLibraryAddUsageDescription: 'Guardamos fotos capturadas por la app en tu galería.',
      UIBackgroundModes: ['fetch'],
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

  // Variables disponibles en runtime (process.env.*). Ajustá BACKEND_BASE_URL cuando tengas la real.
  extra: {
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL ?? 'https://example.com',
    AUTH_SCHEME: 'Bearer',
    SYNC_BATCH_SIZE: 10,
    RETRY_MAX_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 600,
  },

  // Tipados de Expo Router (opcional pero útil)
  experiments: {
    typedRoutes: true,
  },
})
