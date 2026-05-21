'use client'

import React, { createContext, useContext, useCallback } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'

interface TokenContextType {
  token: string | null
  setToken: (token: string) => void
  clearToken: () => void
  isLoading: boolean
  refreshToken: () => Promise<string | null>
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

function TokenProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  const setToken = (_: string) => {
    // no-op: token lifecycle is managed by OAuth
  }

  const clearToken = useCallback(() => {
    signOut()
  }, [])

  // Fetches a guaranteed-fresh access token from the server.
  // The server JWT callback auto-refreshes via refresh_token if expired.
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/gmail/token')
      if (!res.ok) return null
      const data = await res.json()
      return (data.accessToken as string) ?? null
    } catch {
      return null
    }
  }, [])

  return (
    <TokenContext.Provider
      value={{
        token: session?.accessToken ?? null,
        setToken,
        clearToken,
        isLoading: status === 'loading',
        refreshToken,
      }}
    >
      {children}
    </TokenContext.Provider>
  )
}

export function TokenProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TokenProviderInner>{children}</TokenProviderInner>
    </SessionProvider>
  )
}

export function useToken() {
  const context = useContext(TokenContext)
  if (context === undefined) {
    throw new Error('useToken must be used within TokenProvider')
  }
  return context
}
