import * as SecureStore from 'expo-secure-store'
import type { UserSessionRepo } from '@entities/user/ports'
import { SessionError, type SessionRecord } from '@entities/user/model'

// Claves privadas
const KEY_ID = 'kma.session.idToken'
const KEY_AT = 'kma.session.accessToken'
const KEY_RF = 'kma.session.refreshToken'
const KEY_EX = 'kma.session.expiresAt'

const KEYCHAIN_SERVICE = 'kma.session'

// Opciones base
const baseOpts = {
  keychainService: KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const

async function ensureAvailable() {
  const ok = await SecureStore.isAvailableAsync()
  if (!ok) {
    throw new SessionError('PERSISTENCE_FAILED', 'SecureStore not available on this device')
  }
}

// --- Utilidades de almacenamiento con CHUNKS
const CHUNK_META_SUFFIX = '.chunks'
const MAX_CHUNK_LEN = 1800

async function secureSet(key: string, value: string | null): Promise<void> {
  await ensureAvailable()
  try {
    if (value == null) {
      // borrar chunks si existieran
      const meta = await SecureStore.getItemAsync(key + CHUNK_META_SUFFIX, baseOpts)
      if (meta) {
        const total = Number(meta)
        for (let i = 0; i < total; i++) {
          await SecureStore.deleteItemAsync(`${key}.${i}`, baseOpts)
        }
        await SecureStore.deleteItemAsync(key + CHUNK_META_SUFFIX, baseOpts)
      }
      await SecureStore.deleteItemAsync(key, baseOpts)
      return
    }

    // si el valor es pequeño, guardar normal y limpiar restos de chunks
    if (value.length <= MAX_CHUNK_LEN) {
      await SecureStore.setItemAsync(key, value, baseOpts)
      const meta = await SecureStore.getItemAsync(key + CHUNK_META_SUFFIX, baseOpts)
      if (meta) {
        const total = Number(meta)
        for (let i = 0; i < total; i++) {
          await SecureStore.deleteItemAsync(`${key}.${i}`, baseOpts)
        }
        await SecureStore.deleteItemAsync(key + CHUNK_META_SUFFIX, baseOpts)
      }
      return
    }

    // valor grande → guardar en chunks
    const parts: string[] = []
    for (let i = 0; i < value.length; i += MAX_CHUNK_LEN) {
      parts.push(value.slice(i, i + MAX_CHUNK_LEN))
    }
    // limpiar clave base por si existe
    await SecureStore.deleteItemAsync(key, baseOpts)
    // guardar cada chunk
    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, parts[i], baseOpts)
    }
    // meta con cantidad de chunks
    await SecureStore.setItemAsync(key + CHUNK_META_SUFFIX, String(parts.length), baseOpts)
  } catch (err) {
    throw new SessionError('PERSISTENCE_FAILED', `Secure write failed for ${key}`)
  }
}

async function secureGet(key: string): Promise<string | null> {
  await ensureAvailable()
  try {
    // intentar clave simple
    const simple = await SecureStore.getItemAsync(key, baseOpts)
    if (simple != null) return simple

    // si no hay simple, ver si existen chunks
    const meta = await SecureStore.getItemAsync(key + CHUNK_META_SUFFIX, baseOpts)
    if (!meta) return null
    const total = Number(meta)
    if (!Number.isFinite(total) || total <= 0) return null

    const parts: string[] = []
    for (let i = 0; i < total; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`, baseOpts)
      parts.push(part ?? '')
    }
    return parts.join('')
  } catch (err) {
    throw new SessionError('PERSISTENCE_FAILED', `Secure read failed for ${key}`)
  }
}

async function write(key: string, value: string | null): Promise<void> {
  await secureSet(key, value)
}
async function read(key: string): Promise<string | null> {
  return secureGet(key)
}

function validate(rec: Partial<SessionRecord>): rec is SessionRecord {
  return (
    typeof rec.idToken === 'string' &&
    typeof rec.accessToken === 'string' &&
    typeof rec.refreshToken === 'string' &&
    typeof rec.expiresAt === 'number' &&
    Number.isFinite(rec.expiresAt)
  )
}

export function createUserSessionSecureRepo(): UserSessionRepo {
  return {
    async save(rec: SessionRecord): Promise<void> {
      try {
        await Promise.all([
          write(KEY_ID, rec.idToken),
          write(KEY_AT, rec.accessToken),
          write(KEY_RF, rec.refreshToken),
          write(KEY_EX, String(rec.expiresAt)),
        ])
      } catch (e) {
        if (e instanceof SessionError) throw e
        throw new SessionError('PERSISTENCE_FAILED', 'Fallo al guardar la sesión')
      }
    },

    async read(): Promise<SessionRecord | null> {
      const [idToken, accessToken, refreshToken, expiresAtStr] = await Promise.all([
        read(KEY_ID),
        read(KEY_AT),
        read(KEY_RF),
        read(KEY_EX),
      ])

      if (!idToken && !refreshToken && !expiresAtStr && !accessToken) return null

      const partial: Partial<SessionRecord> = { accessToken: accessToken ?? '' }
      if (idToken) partial.idToken = idToken
      if (refreshToken) partial.refreshToken = refreshToken
      if (expiresAtStr) {
        const n = Number(expiresAtStr)
        if (Number.isFinite(n)) partial.expiresAt = n
      }

      if (!validate(partial)) {
        // Limpiar datos corruptos para evitar loops
        await Promise.all([
          write(KEY_ID, null),
          write(KEY_AT, null),
          write(KEY_RF, null),
          write(KEY_EX, null),
        ])
        throw new SessionError('CORRUPTED_DATA', 'Datos de sesión inválidos')
      }

      return partial
    },

    async clear(): Promise<void> {
      try {
        await Promise.all([
          write(KEY_ID, null),
          write(KEY_AT, null),
          write(KEY_RF, null),
          write(KEY_EX, null),
        ])
      } catch (e) {
        if (e instanceof SessionError) throw e
        throw new SessionError('PERSISTENCE_FAILED', 'Fallo al limpiar la sesión')
      }
    },
  }
}
