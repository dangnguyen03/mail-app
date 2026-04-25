'use client'

import { useEffect, useState } from 'react'
import { Contact } from '@/lib/types'
import { useReplyTracking } from '@/app/hooks/useReplyTracking'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PollingStatusProps {
  contacts: Contact[]
  token: string | null
  onReplyDetected: (contactId: string) => void
}

export function PollingStatus({
  contacts,
  token,
  onReplyDetected,
}: PollingStatusProps) {
  const [isEnabled, setIsEnabled] = useState(false)
  const { isPolling, lastChecked, error, startPolling, stopPolling } =
    useReplyTracking(token)

  // Get user email from token if possible
  const userEmail = 'your.email@gmail.com'

  const handleTogglePolling = () => {
    if (!isEnabled) {
      startPolling(contacts, userEmail, onReplyDetected, 60000) // 1 minute interval
      setIsEnabled(true)
    } else {
      stopPolling()
      setIsEnabled(false)
    }
  }

  // Get contacts that are awaiting replies
  const sentContacts = contacts.filter((c) => c.status === 'sent')
  const repliedContacts = contacts.filter((c) => c.status === 'replied')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Reply Tracking</CardTitle>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isPolling ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isPolling ? 'Active' : 'Inactive'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Monitoring {sentContacts.length} sent email
              {sentContacts.length !== 1 ? 's' : ''} for replies
            </p>
            <p className="text-sm">
              <CheckCircle2 className="inline w-4 h-4 mr-1 text-green-600" />
              {repliedContacts.length} replies detected
            </p>
          </div>

          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Last checked:{' '}
              {new Date(lastChecked).toLocaleTimeString()}
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleTogglePolling}
            disabled={sentContacts.length === 0 || !token}
            variant={isEnabled ? 'destructive' : 'default'}
            className="w-full gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            {isEnabled ? 'Stop Polling' : 'Start Polling'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
