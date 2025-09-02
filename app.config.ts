import type { ExpoConfig } from '@expo/config'

const config: ExpoConfig = {
  name: 'KMA_app',
  slug: 'kma_app',
  extra: {
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL ?? 'https://example.com', //!CONFIGURAR CUANDO SE TENGA LA URL
    AUTH_SCHEME: 'Bearer',
    SYNC_BATCH_SIZE: 10,
    RETRY_MAX_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 600,
  },
}

export default config
