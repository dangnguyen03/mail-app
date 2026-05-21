import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const PLACEHOLDER_ENV_VALUES = new Set([
  '',
  'your_google_client_id_here',
  'your_google_client_secret_here',
])

const REQUIRED_GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value && !PLACEHOLDER_ENV_VALUES.has(value)) {
      return value
    }
  }
  return undefined
}

export function getGoogleAuthConfig() {
  const clientId = readEnv('GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_ID')
  const clientSecret = readEnv('GOOGLE_CLIENT_SECRET', 'AUTH_GOOGLE_SECRET')

  return {
    clientId,
    clientSecret,
    isConfigured: Boolean(clientId && clientSecret),
  }
}

function hasRequiredGmailScope(scopeValue: unknown) {
  if (typeof scopeValue !== 'string') return false
  return scopeValue.split(' ').includes(REQUIRED_GMAIL_SCOPE)
}

const googleAuthConfig = getGoogleAuthConfig()

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    if (!googleAuthConfig.clientId || !googleAuthConfig.clientSecret) {
      throw new Error('Missing Google OAuth configuration')
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleAuthConfig.clientId,
        client_secret: googleAuthConfig.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw data
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
      refreshToken: (data.refresh_token as string) ?? token.refreshToken,
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' as const }
  }
}

export const authOptions: NextAuthOptions = {
  providers: googleAuthConfig.isConfigured
    ? [
        GoogleProvider({
          clientId: googleAuthConfig.clientId,
          clientSecret: googleAuthConfig.clientSecret,
          authorization: {
            params: {
              scope: 'openid email profile https://www.googleapis.com/auth/gmail.modify',
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const grantedScope = account.scope

        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          grantedScope,
          error: hasRequiredGmailScope(grantedScope) ? undefined : 'MissingGmailScope',
        }
      }
      // Token still valid (with 60s buffer)
      if (Date.now() < (token.expiresAt as number) * 1000 - 60_000) {
        return token
      }
      // Token expired — refresh it
      return refreshAccessToken(token as Record<string, unknown>)
    },
    async session({ session, token }) {
      session.accessToken = token.error === 'MissingGmailScope'
        ? undefined
        : token.accessToken as string
      session.error = token.error as string | undefined
      session.grantedScope = token.grantedScope as string | undefined
      return session
    },
  },
}
