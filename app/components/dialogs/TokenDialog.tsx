'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Mail } from 'lucide-react'

interface TokenDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function TokenDialog({ isOpen, onOpenChange }: TokenDialogProps) {
  const { data: session } = useSession()
  const [isAuthConfigured, setIsAuthConfigured] = useState(true)
  const [isCheckingConfig, setIsCheckingConfig] = useState(false)
  const isMissingGmailScope = session?.error === 'MissingGmailScope'

  useEffect(() => {
    if (!isOpen || session) return

    let isCancelled = false

    async function loadConfigStatus() {
      setIsCheckingConfig(true)

      try {
        const res = await fetch('/api/auth/config-status', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load auth config status')

        const data = (await res.json()) as { isConfigured?: boolean }
        if (!isCancelled) {
          setIsAuthConfigured(Boolean(data.isConfigured))
        }
      } catch {
        if (!isCancelled) {
          setIsAuthConfigured(false)
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingConfig(false)
        }
      }
    }

    void loadConfigStatus()

    return () => {
      isCancelled = true
    }
  }, [isOpen, session])

  const handleSignIn = () => {
    if (!isAuthConfigured) return
    signIn('google', { callbackUrl: '/' })
  }

  const handleSignOut = async () => {
    onOpenChange(false)
    await signOut({ callbackUrl: '/' })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {session ? 'Gmail Account' : 'Sign in with Google'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {session
              ? 'Your Gmail account is connected.'
              : isMissingGmailScope
                ? 'Google sign-in succeeded, but this OAuth app was not granted gmail.modify. Add the Gmail API scope in Google Cloud OAuth consent screen, add your Gmail as a test user if the app is in Testing, then sign in again.'
              : isAuthConfigured
                ? 'Connect your Gmail account to enable email sending.'
                : 'Google OAuth is not configured yet. Set a real GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET before signing in.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {session && !isMissingGmailScope ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar className="w-10 h-10">
                <AvatarImage src={session.user?.image ?? ''} alt={session.user?.name ?? ''} />
                <AvatarFallback>
                  <Mail className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{session.user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
              </div>
            </div>
            <Button
              variant="destructive"
              className="w-full cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            className="w-full cursor-pointer"
            variant="outline"
            onClick={handleSignIn}
            disabled={!isAuthConfigured || isCheckingConfig}
          >
            <GoogleIcon />
            <span className="ml-2">
              {isCheckingConfig
                ? 'Checking Google OAuth...'
                : isMissingGmailScope
                  ? 'Sign in with Google again'
                  : 'Sign in with Google'}
            </span>
          </Button>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
