import { Platform } from 'react-native'

export type FlowStepImageLike = {
  image?: string
  images?: string[]
}

const warnedUnsupportedBlobUrls = new Set<string>()

function warnUnsupportedBlobUrl(url: string): void {
  if (!__DEV__) return
  if (warnedUnsupportedBlobUrls.has(url)) return

  warnedUnsupportedBlobUrls.add(url)
  console.warn('[flowStepImages] Ignoring blob image URL on native', url)
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  if (Platform.OS !== 'web' && trimmed.toLowerCase().startsWith('blob:')) {
    warnUnsupportedBlobUrl(trimmed)
    return null
  }

  return trimmed
}

export function resolveStepImageUrls(step: FlowStepImageLike | null | undefined): string[] {
  if (!step) return []

  const images = Array.isArray(step.images)
    ? step.images.map(normalizeImageUrl).filter((value): value is string => value !== null)
    : []

  if (images.length > 0) {
    return images
  }

  const singleImage = normalizeImageUrl(step.image)
  return singleImage ? [singleImage] : []
}
