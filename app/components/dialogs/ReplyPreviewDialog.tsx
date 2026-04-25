'use client'

import { useState, useEffect, useMemo } from 'react'
import { Contact, GmailMessage } from '@/lib/types'
import { GmailService } from '@/lib/gmail'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

interface ReplyPreviewDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  token: string | null
}

export function ReplyPreviewDialog({
  isOpen,
  onOpenChange,
  contact,
  token,
}: ReplyPreviewDialogProps) {
  const [replyEmail, setReplyEmail] = useState<{ from: string; subject: string; body: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gmail = useMemo(() => (token ? new GmailService(token) : null), [token])

  const getHtmlBody = (message: GmailMessage): string => {
    let encodedBody = ''
    const findHtmlPart = (parts: any[]) => {
      for (const part of parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          encodedBody = part.body.data
          return
        }
        if (part.parts) findHtmlPart(part.parts)
      }
    }

    if (message.payload?.mimeType === 'text/html' && message.payload.body?.data) {
      encodedBody = message.payload.body.data
    } else if (message.payload?.parts) {
      findHtmlPart(message.payload.parts)
    }

    if (encodedBody) {
      try {
        const base64 = encodedBody.replace(/-/g, '+').replace(/_/g, '/')
        return decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
      } catch (e) {
        console.error('Failed to decode email body:', e)
        return '<p>Could not decode email body.</p>'
      }
    }
    return message.snippet || '<p>No preview available.</p>'
  }

  useEffect(() => {
    if (isOpen && contact?.threadId && gmail) {
      setIsLoading(true)
      setError(null)
      setReplyEmail(null)
      gmail.getThread(contact.threadId).then((thread) => {
        const lastMessage = thread.messages?.[thread.messages.length - 1]
        if (lastMessage) {
          const subjectHeader = lastMessage.payload?.headers.find((h) => h.name === 'Subject')?.value || '(No Subject)'
          const fromHeader = lastMessage.payload?.headers.find((h) => h.name === 'From')?.value || '(Unknown Sender)'
          const body = getHtmlBody(lastMessage)
          setReplyEmail({ subject: subjectHeader, from: fromHeader, body })
        } else {
          setError('Could not find the reply message in the thread.')
        }
      }).catch(() => {
        setError('Failed to load the email thread. The token might be expired.')
      }).finally(() => {
        setIsLoading(false)
      })
    }
  }, [isOpen, contact, gmail])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reply from {contact?.name}</DialogTitle>
          <DialogDescription>
            {isLoading ? 'Loading message...' : replyEmail?.subject}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          {isLoading && <div className="flex justify-center items-center p-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {replyEmail && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="text-sm text-muted-foreground mb-4">
                <p><span className="font-semibold text-foreground">From:</span> {replyEmail.from}</p>
                <p><span className="font-semibold text-foreground">Subject:</span> {replyEmail.subject}</p>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none bg-background p-4 rounded-md border"
                dangerouslySetInnerHTML={{ __html: replyEmail.body }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}