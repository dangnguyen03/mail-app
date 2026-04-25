'use client'

import { useState } from 'react'
import { useToken } from '@/app/components/provider/TokenProvider'
import { validateToken } from '@/lib/gmail'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertCircle, Copy, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface TokenDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TokenDialog({ isOpen, onOpenChange }: TokenDialogProps) {
  const { token, setToken, clearToken } = useToken()
  const [inputToken, setInputToken] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showClear, setShowClear] = useState(false)

  const handleValidateAndSave = async () => {
    setError(null)
    setIsValidating(true)

    try {
      const isValid = await validateToken(inputToken)
      if (!isValid) {
        setError('Invalid token. Please check and try again.')
        return
      }

      setToken(inputToken)
      setInputToken('')
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to validate token'
      )
    } finally {
      setIsValidating(false)
    }
  }

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClearToken = () => {
    clearToken()
    setShowClear(false)
    onOpenChange(false)
  }

  if (showClear) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Gmail Token?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out and remove the stored access token. You&apos;ll need
              to provide a new token to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel onClick={() => setShowClear(false)}>
              Keep Token
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearToken}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Token
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {token ? 'Gmail Token Active' : 'Add Gmail Access Token'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {token
              ? 'Your Gmail access token is configured. You can replace it or clear it below.'
              : 'Paste your Gmail OAuth access token to enable email sending.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {token ? (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-mono text-muted-foreground">
                {token.substring(0, 20)}...
              </p>
            </div>
            <Button
              onClick={handleCopyToken}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Token
                </>
              )}
            </Button>
            <div className="space-y-2">
              <label className="text-sm font-medium">Replace Token</label>
              <Input
                placeholder="Paste new access token..."
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                type="password"
              />
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleValidateAndSave}
                disabled={!inputToken || isValidating}
                className="w-full"
              >
                {isValidating ? 'Validating...' : 'Update Token'}
              </Button>
            </div>
            <Button
              onClick={() => setShowClear(true)}
              variant="destructive"
              className="w-full"
            >
              Clear Token
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>How to Get Your Token</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                  <li>Visit <a href="https://developers.google.com/oauthplayground/?" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">OAuth 2.0 Playground</a></li>
                  <li>Find "https://www.googleapis.com/auth/gmail.modify"</li>
                  <li>Click "Authorize APIs" to get a token</li>
                  <li>Paste the access token below</li>
                </ol>
              </AlertDescription>
            </Alert>
            <Input
              placeholder="Paste your Gmail access token..."
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              type="password"
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleValidateAndSave}
              disabled={!inputToken || isValidating}
              className="w-full"
            >
              {isValidating ? 'Validating...' : 'Add Token'}
            </Button>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
