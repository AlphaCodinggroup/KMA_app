export type SessionTokens = { accessToken?: string; refreshToken?: string }

let _tokens: SessionTokens = {}

export function setSessionTokens(tokens?: SessionTokens | null) {
  _tokens = tokens ?? {}
}

export function getAccessToken(): string | null {
  return _tokens.accessToken ?? null
}

export function getRefreshToken(): string | null {
  return _tokens.refreshToken ?? null
}

export function clearSessionTokens() {
  _tokens = {}
}
