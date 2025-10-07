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
      // UISupportedInterfaceOrientations: [
      //   'UIInterfaceOrientationPortrait',
      //   'UIInterfaceOrientationPortraitUpsideDown',
      //   'UIInterfaceOrientationLandscapeLeft',
      //   'UIInterfaceOrientationLandscapeRight',
      // ],
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

  // Variables disponibles en runtime (process.env.*). Ajustá BACKEND_BASE_URL cuando tengas la real.
  extra: {
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL ?? 'https://example.com',
    AUTH_SCHEME: 'Bearer',
    SYNC_BATCH_SIZE: 10,
    RETRY_MAX_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 600,
    eas: {
      projectId: '1b6bf518-a922-462a-814e-460280053abf',
    },
  },

  // Tipados de Expo Router (opcional pero útil)
  experiments: {
    typedRoutes: true,
  },
})
