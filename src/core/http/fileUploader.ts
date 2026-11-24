import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'

import { Env } from '@shared/config/env'

/**
 * Subida de archivos locales a una URL presignada (S3).
 *
 * - Streaming nativo (`uploadAsync` BINARY_CONTENT): el archivo nunca se carga en memoria JS.
 * - NO manda Authorization (la URL ya viene firmada).
 * - En iOS usa una sesión BACKGROUND de URLSession: una subida ya iniciada sigue si la app pasa a segundo plano.
 * - Reintenta sólo 429 / 5xx (salvo 501) y fallos de red. Un 403 indica URL vencida o firma inválida:
 *   no se reintenta acá, falla y se re-firma en el reintento del outbox.
 */
export interface UploadFileArgs {
  url: string
  localUri: string
  contentType: string
  maxAttempts?: number
}

export interface FileUploader {
  upload(args: UploadFileArgs): Promise<{ status: number }>
}

/** Error con la misma forma `response.status` que usan los `catch` de los usecases (extractStatus). */
export class UploadError extends Error {
  response: { status: number }
  constructor(status: number) {
    super(`Upload failed with HTTP ${status}`)
    this.name = 'UploadError'
    this.response = { status }
  }
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status !== 501)
}

export const expoFileUploader: FileUploader = {
  async upload({ url, localUri, contentType, maxAttempts = Env.retry.maxAttempts }) {
    const baseDelayMs = Env.retry.baseDelayMs
    let attempt = 0

    for (;;) {
      let status: number | null = null
      let networkError: unknown = null

      try {
        const res = await FileSystem.uploadAsync(url, localUri, {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': contentType },
          ...(Platform.OS === 'ios'
            ? { sessionType: FileSystem.FileSystemSessionType.BACKGROUND }
            : {}),
        })
        status = res.status
      } catch (err) {
        // uploadAsync rechaza ante fallos de red / archivo inexistente
        networkError = err
      }

      if (status !== null && status >= 200 && status < 300) return { status }

      // `uploadAsync` no lanza en 4xx/5xx: se valida el status a mano
      const retryable = status === null || isRetryableStatus(status)
      if (!retryable || attempt >= maxAttempts) {
        if (status !== null) throw new UploadError(status)
        throw networkError instanceof Error ? networkError : new Error('Upload failed')
      }

      const max = baseDelayMs * Math.pow(2, attempt)
      attempt += 1
      await sleep(Math.floor(Math.random() * max) + Math.floor(Math.random() * 100))
    }
  },
}
