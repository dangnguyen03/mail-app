'use client'

import { useState, useEffect, useMemo } from 'react'
import { Contact, EmailTemplate } from '@/lib/types'
import { GmailService } from '@/lib/gmail'
import { useToken } from '@/app/components/provider/TokenProvider'
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
import { AlertCircle, ChevronDown, Mail, Pin, RotateCcw } from 'lucide-react'

export type ResendMode = 'resend' | 'remind'

interface ResendDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  templates: EmailTemplate[]
  token: string | null
  mode?: ResendMode
  /** Template used for the previous send — pre-selected when the dialog opens. */
  defaultTemplateId?: string | null
  onTemplateUsed?: (templateId: string) => void
  onResendSuccess: (contact: Contact, messageId: string, threadId: string, rfc822MessageId?: string, threadIndex?: string) => void
}

export function ResendDialog({
  isOpen,
  onOpenChange,
  contact,
  templates,
  token,
  mode = 'resend',
  defaultTemplateId,
  onTemplateUsed,
  onResendSuccess,
}: ResendDialogProps) {
  const { refreshToken } = useToken()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [originalEmail, setOriginalEmail] = useState<{ subject: string; body: string; snippet: string } | null>(null)
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  // RFC 2822 Message-IDs extracted from the thread — passed to sendEmail so
  // In-Reply-To / References headers are set correctly for recipient threading.
  const [threadMessageIds, setThreadMessageIds] = useState<string[]>([])

  const gmail = useMemo(() => (token ? new GmailService(token) : null), [token])

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
      // The dialog is mounted fresh on every open, so this initial pick is also
      // where the remembered template gets applied.
      const preferred = templates.find((t) => t.id === defaultTemplateId) ?? templates[0]
      setSelectedTemplateId(preferred.id)
    }

    if (isOpen && mode === 'remind' && contact?.threadId && gmail) {
      setIsLoadingOriginal(true)
      setOriginalEmail(null)
      setThreadMessageIds([])

      gmail
        .getThread(contact.threadId)
        .then((thread) => {
          if (!thread.messages?.length) return

          // Extract RFC 2822 Message-IDs from every message in the thread.
          // These are the <CA+...@mail.gmail.com> header values — NOT Gmail's
          // internal numeric IDs — needed so recipient clients thread the reply.
          const rfcIds = thread.messages
            .map((msg) =>
              msg.payload?.headers?.find(
                (h) => h.name.toLowerCase() === 'message-id'
              )?.value
            )
            .filter((id): id is string => Boolean(id))

          setThreadMessageIds(rfcIds)

          // Subject must come from the FIRST message (original email) so that
          // Thread-Topic stays consistent across all reminds. Using the last
          // message's subject would use the remind template subject after the
          // first remind, breaking Outlook's Thread-Topic chain.
          const firstMessage = thread.messages[0]
          const lastMessage = thread.messages[thread.messages.length - 1]
          const subjectHeader = firstMessage.payload?.headers?.find((h) => h.name === 'Subject')
          const body = getHtmlBody(lastMessage)
          setOriginalEmail({
            subject: subjectHeader?.value || '(No Subject)',
            snippet: lastMessage.snippet || '(No Content)',
            body,
          })
        })
        .catch(() => setError('Could not load original email thread.'))
        .finally(() => setIsLoadingOriginal(false))
    }
  }, [templates, selectedTemplateId, isOpen, contact, gmail, mode, defaultTemplateId])

  const handleSend = async () => {
    if (!contact || !selectedTemplateId || !token) {
      setError('Missing required information')
      return
    }

    if (mode === 'remind' && !contact.threadId) {
      setError('No thread found for this contact. Use Resend to send a new email instead.')
      return
    }

    if (mode === 'remind' && isLoadingOriginal) {
      setError('Original thread is still loading. Please wait a moment and try again.')
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
      // Fetch a fresh token before sending (auto-refreshes if expired)
      const freshToken = (await refreshToken()) ?? token
      const gmail = new GmailService(freshToken!)

      const templateSubject = template.subject.replace(/{{name}}/g, contact.name)
      const body = template.body.replace(/{{name}}/g, contact.name)

      const isRemind = mode === 'remind'
      const subject = isRemind
        ? (originalEmail?.subject || templateSubject)
        : templateSubject

      // In-Reply-To must point to the FIRST (original) email's Message-ID — the
      // one message we know the recipient definitely has in their inbox.
      // Using the last message is unreliable: if a previous remind failed to
      // thread in the recipient's mailbox, its ID doesn't exist in their thread,
      // and every subsequent remind also fails.
      // References carries the full chain so clients can reconstruct history.
      const storedMessageId = contact.rfc822MessageId
      const inReplyToMessageId = isRemind
        ? (threadMessageIds.length > 0 ? threadMessageIds[0] : storedMessageId)
        : undefined
      const referencesHeader = isRemind
        ? (threadMessageIds.length > 0 ? threadMessageIds.join(' ') : storedMessageId)
        : undefined

      const response = await gmail.sendEmail({
        to: contact.email,
        subject,
        body,
        bodyType: template.bodyType ?? 'html',
        threadId: isRemind ? contact.threadId : undefined,
        inReplyToMessageId,
        referencesHeader,
        // Outlook Thread-Index: append to stored parent index if available
        parentThreadIndex: isRemind ? contact.threadIndex : undefined,
        // Outlook Thread-Topic: use original email's subject so conversation header is consistent
        threadTopic: isRemind ? (originalEmail?.subject ?? subject) : subject,
      })

      onTemplateUsed?.(template.id)
      onResendSuccess(contact, response.id, response.threadId, response.rfc822MessageId, response.threadIndex)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  const dialogTitle =
    mode === 'remind'
      ? 'Remind (Reply)'
      : contact?.status === 'pending'
      ? 'Send Email'
      : 'Resend Email'

  const dialogDescription =
    mode === 'remind'
      ? `Send a reply in the existing thread to ${contact?.name} (${contact?.email})`
      : `Send a follow-up email to ${contact?.name} (${contact?.email})`

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'remind' && <RotateCcw className="w-4 h-4" />}
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium block mb-2">Template to use</label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="flex items-center gap-1.5">
                      {template.id === defaultTemplateId && (
                        <Pin className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                      {template.subject}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.some((t) => t.id === defaultTemplateId) && (
              <p className="text-xs text-muted-foreground mt-1">
                <Pin className="w-3 h-3 inline mr-1" />
                Template dùng lần trước đã được chọn sẵn — đổi lại nếu cần.
              </p>
            )}
          </div>

          {selectedTemplate && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-2">Preview:</p>
              <p className="font-semibold mb-2">
                {selectedTemplate.subject.replace(/{{name}}/g, contact?.name || 'Recipient')}
              </p>
              <div
                className="prose prose-sm dark:prose-invert max-w-none overflow-hidden text-ellipsis h-24 text-xs"
                dangerouslySetInnerHTML={{
                  __html: selectedTemplate.body.replace(/{{name}}/g, contact?.name || 'Recipient'),
                }}
              />
            </div>
          )}

          {mode === 'remind' && (
            <Alert>
              <div className="flex flex-col">
                <div className="flex items-start">
                  <Mail className="h-4 w-4 mr-2 mt-1" />
                  <div className="flex-grow">
                    <AlertTitle>Replying in thread</AlertTitle>
                    <AlertDescription>
                      {isLoadingOriginal
                        ? 'Loading original email...'
                        : originalEmail
                        ? `Reply to: "${originalEmail.subject}"`
                        : 'This will be sent as a reply to the original thread.'}
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

          {mode === 'resend' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will be sent as a <strong>new email</strong> (not a reply).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedTemplateId || isSending || (mode === 'remind' && isLoadingOriginal)}
          >
            {isSending ? 'Sending...' : mode === 'remind' ? 'Send Reply' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
