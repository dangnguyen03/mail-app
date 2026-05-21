export type ContactStatus = 'pending' | 'sent' | 'replied'

export interface Campaign {
  id: string
  name: string
  createdAt: number
}

export interface Contact {
  id: string
  email: string
  name: string
  status: ContactStatus
  messageId?: string       // Gmail internal message ID
  threadId?: string        // Gmail internal thread ID
  rfc822MessageId?: string // RFC 2822 Message-ID of last sent message (<CA+...@mailapp>)
  threadIndex?: string     // Outlook Thread-Index of last sent message (base64)
  lastSentAt?: number
  resendCount: number
  createdAt: number
  campaignId?: string
}

export interface EmailTemplate {
  id: string
  subject: string
  body: string
  bodyType?: 'html' | 'text'
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
  bodyType?: 'html' | 'text'
  threadId?: string
  // Threading headers — supply when replying so recipient clients group correctly
  inReplyToMessageId?: string // RFC 2822 Message-ID of the message being replied to
  referencesHeader?: string   // Space-separated chain of all Message-IDs in the thread
  parentThreadIndex?: string  // Caller's stored Thread-Index for appending (Outlook)
  threadTopic?: string        // Original conversation subject (Outlook Thread-Topic)
}

export interface SendEmailResponse {
  id: string
  threadId: string
  labelIds?: string[]
}

/** Extended result returned by GmailService.sendEmail — includes generated headers */
export interface SendResult extends SendEmailResponse {
  rfc822MessageId: string // The Message-ID we set in the raw email
  threadIndex: string     // The Thread-Index we set (initial or appended)
}
