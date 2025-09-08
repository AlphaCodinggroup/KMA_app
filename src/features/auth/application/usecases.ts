export type LoginTokens = { accessToken: string; refreshToken?: string; expiresAt?: number }

export async function loginUseCase(email: string, password: string): Promise<LoginTokens> {
  // TODO: reemplazar por llamada real a API
  await new Promise(r => setTimeout(r, 400))
  if (!email || !password) throw new Error('Missing credentials')
  return { accessToken: 'fake-access-token', refreshToken: 'fake-rt' }
}
