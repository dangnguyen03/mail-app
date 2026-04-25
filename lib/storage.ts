const TOKEN_KEY = 'gmail_access_token'

export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_KEY, token)
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(TOKEN_KEY)
  }
  return null
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_KEY)
  }
}

export function hasToken(): boolean {
  return getToken() !== null
}
