import * as SecureStore from 'expo-secure-store'

export async function writeSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, { keychainService: 'kma_app' })
}

export async function readSecure(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, { keychainService: 'kma_app' })
}

export async function deleteSecure(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key)
}

export async function writeJsonSecure(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value))
}

export async function readJsonSecure<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
