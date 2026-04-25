// 'use client'

// import React, { createContext, useContext, useState, useEffect } from 'react'
// import { getToken, saveToken, clearToken } from '@/lib/storage'

// interface TokenContextType {
//   token: string | null
//   setToken: (token: string) => void
//   clearToken: () => void
//   isLoading: boolean
// }

// const TokenContext = createContext<TokenContextType | undefined>(undefined)

// export function TokenProvider({ children }: { children: React.ReactNode }) {
//   const [token, setTokenState] = useState<string | null>(null)
//   const [isLoading, setIsLoading] = useState(true)

//   // Initialize token from sessionStorage
//   useEffect(() => {
//     const savedToken = getToken()
//     setTokenState(savedToken)
//     setIsLoading(false)
//   }, [])

//   const setToken = (newToken: string) => {
//     saveToken(newToken)
//     setTokenState(newToken)
//   }

//   const handleClearToken = () => {
//     clearToken()
//     setTokenState(null)
//   }

//   return (
//     <TokenContext.Provider
//       value={{ token, setToken, clearToken: handleClearToken, isLoading }}
//     >
//       {children}
//     </TokenContext.Provider>
//   )
// }

// export function useToken() {
//   const context = useContext(TokenContext)
//   if (context === undefined) {
//     throw new Error('useToken must be used within TokenProvider')
//   }
//   return context
// }

'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getToken, saveToken, clearToken } from '@/lib/storage'

interface TokenContextType {
  token: string | null
  setToken: (token: string) => void
  clearToken: () => void
  isLoading: boolean
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedToken = getToken()
    setTokenState(savedToken)
    setIsLoading(false)
    setMounted(true)
  }, [])

  // 🔥 Quan trọng: tránh hydration mismatch
  if (!mounted) return null

  const setToken = (newToken: string) => {
    saveToken(newToken)
    setTokenState(newToken)
  }

  const handleClearToken = () => {
    clearToken()
    setTokenState(null)
  }

  return (
    <TokenContext.Provider
      value={{ token, setToken, clearToken: handleClearToken, isLoading }}
    >
      {children}
    </TokenContext.Provider>
  )
}

export function useToken() {
  const context = useContext(TokenContext)
  if (context === undefined) {
    throw new Error('useToken must be used within TokenProvider')
  }
  return context
}