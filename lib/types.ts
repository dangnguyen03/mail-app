export type ContactStatus = 'pending' | 'sent' | 'replied'

export interface Contact {
  id: string
  email: string
  name: string
  status: ContactStatus
  messageId?: string
  threadId?: string
  lastSentAt?: number
  resendCount: number
  createdAt: number
}

export interface EmailTemplate {
  id: string
  subject: string
  body: string
  createdAt: number
}

export interface SendLog {
  id: string
  contactId: string
  templateId: string
  sentAt: number
  status: 'success' | 'failed'
  errorMessage?: string
  messageId?: string
  threadId?: string
}

interface MessagePartBody {
  attachmentId?: string
  size: number
  data?: string // base64url encoded
}

interface MessagePart {
  partId: string
  mimeType: string
  filename: string
  headers: { name: string; value: string }[]
  body: MessagePartBody
  parts?: MessagePart[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: MessagePart
}

export interface GmailThread {
  id: string
  snippet?: string
  messages?: GmailMessage[]
  historyId?: string
}

export interface SendEmailRequest {
  to: string
  subject: string
  body: string
  threadId?: string
}

export interface SendEmailResponse {
  id: string
  threadId: string
  labelIds?: string[]
}
