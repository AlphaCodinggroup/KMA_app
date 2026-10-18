import * as FileSystem from 'expo-file-system'

/** Por debajo de este espacio libre (~500 MB) se avisa al auditor y se libera lo ya respaldado. */
export const LOW_DISK_BYTES = 500 * 1024 * 1024

/** Espacio libre del dispositivo en bytes, o null si no se pudo consultar. */
export async function getFreeDiskBytes(): Promise<number | null> {
  try {
    return await FileSystem.getFreeDiskStorageAsync()
  } catch {
    return null
  }
}
