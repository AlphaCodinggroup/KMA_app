export type JwtClaims = Record<string, any> | null

/**
 * Decodifica el payload del JWT de forma segura (best-effort; sin validar firma).
 */
export function decodeJwtPayload(token?: string | null): JwtClaims {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4)
    const raw = typeof globalThis.atob === 'function' ? globalThis.atob(padded) : null
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
