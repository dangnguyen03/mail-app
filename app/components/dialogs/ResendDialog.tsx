'use client'

import { useState, useEffect, useMemo } from 'react'
import { Contact, EmailTemplate } from '@/lib/types'
import { GmailService } from '@/lib/gmail'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, ChevronDown, Mail } from 'lucide-react'

interface ResendDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  templates: EmailTemplate[]
  token: string | null
  onResendSuccess: (contact: Contact, messageId: string, threadId: string) => void
}

export function ResendDialog({
  isOpen,
  onOpenChange,
  contact,
  templates,
  token,
  onResendSuccess,
}: ResendDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [originalEmail, setOriginalEmail] = useState<{ subject: string; body: string; snippet: string } | null>(null)
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  const gmail = useMemo(() => (token ? new GmailService(token) : null), [token])

  // Function to find the HTML part of a message
  const getHtmlBody = (message: any): string => {
    let encodedBody = ''

    function findHtmlPart(parts: any[]) {
      for (const part of parts) {
        if (part.mimeType === 'text/html') {
          encodedBody = part.body?.data
          return
        }
        if (part.parts) {
          findHtmlPart(part.parts)
        }
      }
    }

    if (message.payload.mimeType === 'text/html') {
      encodedBody = message.payload.body?.data
    } else if (message.payload.parts) {
      findHtmlPart(message.payload.parts)
    }

    if (encodedBody) {
      try {
        // Decode base64url
        const base64 = encodedBody.replace(/-/g, '+').replace(/_/g, '/')
        return decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      } catch (e) {
        console.error('Failed to decode email body:', e)
        return '<p>Could not decode email body.</p>'
      }
    }
    return message.snippet || '<p>No preview available.</p>'
  }

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id)
    }

    if (isOpen && contact?.status === 'replied' && contact.threadId && gmail) {
      setIsLoadingOriginal(true)
      gmail
        .getThread(contact.threadId)
        .then((thread) => {
          const lastMessage = thread.messages?.[thread.messages.length - 1]
          if (lastMessage) {
            const subjectHeader = lastMessage.payload?.headers.find((h) => h.name === 'Subject')
            const body = getHtmlBody(lastMessage)
            setOriginalEmail({
              subject: subjectHeader?.value || '(No Subject)',
              snippet: lastMessage.snippet || '(No Content)',
              body: body,
            })
          }
        })
        .catch(() => setError('Could not load original email thread.'))
        .finally(() => setIsLoadingOriginal(false))
    }
  }, [templates, selectedTemplateId, isOpen, contact, gmail])

  const handleResend = async () => {
    if (!contact || !selectedTemplateId || !token) {
      setError('Missing required information')
      return
    }

    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) {
      setError('Template not found')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      if (!gmail) throw new Error('Gmail service not available.')

      // Interpolate template variables
      const subject = template.subject.replace(/{{name}}/g, contact.name)
      const body = template.body.replace(/{{name}}/g, contact.name)

      // Send using the threadId to keep conversation
      const response = await gmail.sendEmail({
        to: contact.email,
        subject,
        body,
        threadId: contact.threadId,
      })

      onResendSuccess(contact, response.id, response.threadId)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend email')
    } finally {
      setIsSending(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contact?.status === 'pending' ? 'Send Email' : 'Resend Email'}
          </DialogTitle>
          <DialogDescription>
            Send a follow-up email to {contact?.name} ({contact?.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium block mb-2">
              Template to use
            </label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-2">Preview:</p>
              <p className="font-semibold mb-2">
                {selectedTemplate.subject.replace(
                  /{{name}}/g,
                  contact?.name || 'Recipient'
                )}
              </p>
              <div
                className="prose prose-sm dark:prose-invert max-w-none overflow-hidden text-ellipsis h-24 text-xs"
                dangerouslySetInnerHTML={{
                  __html: selectedTemplate.body.replace(/{{name}}/g, contact?.name || 'Recipient'),
                }}
              />
            </div>
          )}
          {contact?.status === 'replied' && (
            <Alert>
              <div className="flex flex-col">
                <div className="flex items-start">
                  <Mail className="h-4 w-4 mr-2 mt-1" />
                  <div className="flex-grow">
                    <AlertTitle>Replying in thread</AlertTitle>
                    <AlertDescription>
                      {isLoadingOriginal
                        ? 'Loading original email...'
                        : `This will be sent as a reply to: "${originalEmail?.subject}"`}
                    </AlertDescription>
                  </div>
                  {originalEmail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowOriginal(!showOriginal)}
                      className="ml-auto"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${showOriginal ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  )}
                </div>
                {showOriginal && originalEmail && (
                  <div className="mt-4 border-t pt-3">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground h-48 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: originalEmail.body }}
                    />
                  </div>
                )}
              </div>
            </Alert>
          )}
          {!contact?.threadId && contact?.status !== 'pending' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Thread Found</AlertTitle>
              <AlertDescription>
                This email will be sent as a new conversation.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleResend}
            disabled={!selectedTemplateId || isSending}
          >
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
