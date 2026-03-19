export type FlowStepImageLike = {
  image?: string
  images?: string[]
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
