export type ContactStatus = 'pending' | 'sent' | 'replied'

export interface Contact {
  id: string
  email: string
  name: string
  status: ContactStatus
  messageId?: string
  threadId?: string
  createdAt: number
  lastSentAt?: number
  resendCount: number
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
  error?: string
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
}

export interface GmailMessage {
  id: string
  threadId: string
  snippet?: string
  payload?: { headers: { name: string; value: string }[] }
}

export interface GmailThread {
  id: string
  messages?: GmailMessage[]
}