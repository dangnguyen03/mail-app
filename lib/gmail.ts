import { SendEmailRequest, SendEmailResponse, SendResult, GmailThread } from './types'

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'

// ── Thread-Index helpers (Outlook MAPI threading) ──────────────────────────

/**
 * Returns 5 bytes approximating the low bytes of a Windows FILETIME
 * (100-nanosecond intervals since 1601-01-01).
 * Float precision loss in the high bits is acceptable for Thread-Index purposes
 * — we only need monotonically-increasing, unique values, not exact FILETIME.
 */
function filetimeBytes(date: Date = new Date()): number[] {
  const EPOCH_DIFF_MS = 11644473600000 // ms between 1601-01-01 and 1970-01-01
  // Multiply in ms first to stay closer to safe-integer range, then scale
  const ft = (date.getTime() + EPOCH_DIFF_MS) * 10000 // 100ns units (fp approx)
  const bytes: number[] = []
  let val = ft
  for (let i = 4; i >= 0; i--) {
    bytes[i] = val % 256
    val = Math.floor(val / 256)
  }
  return bytes
}

/** Generate a fresh Thread-Index for the first message in a conversation. */
function generateThreadIndex(): string {
  const bytes = new Uint8Array(22)
  bytes[0] = 0x01 // header version
  bytes.set(filetimeBytes(), 1) // bytes 1–5: creation timestamp
  crypto.getRandomValues(bytes.subarray(6)) // bytes 6–21: random GUID
  return btoa(String.fromCharCode(...Array.from(bytes)))
}

/** Append a 5-byte reply timestamp to the parent Thread-Index. */
function appendThreadIndex(parent: string): string {
  const parentBytes = Array.from(atob(parent), (c) => c.charCodeAt(0))
  return btoa(String.fromCharCode(...parentBytes, ...filetimeBytes()))
}

/** Generate a unique RFC 2822 Message-ID. */
function generateMessageId(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `<${rand}@mailapp>`
}

// ───────────────────────────────────────────────────────────────────────────

export class GmailService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  private encodeEmail(params: {
    to: string
    subject: string
    body: string
    bodyType?: 'html' | 'text'
    messageId: string
    inReplyTo?: string
    references?: string
    threadTopic?: string
    threadIndex?: string
  }): string {
    const { to, subject, body, bodyType = 'html', messageId, inReplyTo, references, threadTopic, threadIndex } = params
    const contentType = bodyType === 'text' ? 'text/plain' : 'text/html'

    const headers: string[] = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      `Content-Type: ${contentType}; charset="UTF-8"`,
    ]

    // Outlook conversation headers
    if (threadTopic) headers.push(`Thread-Topic: ${threadTopic}`)
    if (threadIndex) headers.push(`Thread-Index: ${threadIndex}`)

    // Standard reply threading (RFC 5322) — used by Gmail, Outlook, all clients
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`)
      headers.push(`References: ${references || inReplyTo}`)
    }

    const emailContent = headers.join('\r\n') + '\r\n\r\n' + body

    // Convert to base64url (RFC 4648)
    const base64 = btoa(unescape(encodeURIComponent(emailContent)))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /** Fetch the RFC 2822 Message-ID header of a message Gmail has stored. */
  private async fetchActualMessageId(gmailMsgId: string): Promise<string | undefined> {
    try {
      const res = await fetch(
        `${GMAIL_API_BASE}/messages/${gmailMsgId}?format=metadata&metadataHeaders=Message-ID`,
        { method: 'GET', headers: this.getHeaders() }
      )
      if (!res.ok) return undefined
      const data = await res.json()
      return (data.payload?.headers as Array<{ name: string; value: string }> | undefined)
        ?.find((h) => h.name.toLowerCase() === 'message-id')?.value
    } catch {
      return undefined
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendResult> {
    // ── 1. Generate our own Message-ID so we know it upfront ─────────────
    const rfc822MessageId = generateMessageId()

    // ── 2. Thread-Index (Outlook) ─────────────────────────────────────────
    const threadIndex = request.parentThreadIndex
      ? appendThreadIndex(request.parentThreadIndex)
      : generateThreadIndex()

    // ── 3. In-Reply-To / References (RFC 5322, Gmail + all clients) ───────
    // Prefer caller-provided IDs — these were extracted from the thread before
    // opening the dialog, so they're reliable. Only fall back to a thread fetch
    // if the caller didn't supply them.
    let inReplyTo = request.inReplyToMessageId
    let references = request.referencesHeader

    if (!inReplyTo && request.threadId) {
      try {
        const thread = await this.getThread(request.threadId)
        if (thread.messages?.length) {
          const ids = thread.messages
            .map((msg) =>
              msg.payload?.headers?.find(
                (h) => h.name.toLowerCase() === 'message-id'
              )?.value
            )
            .filter((id): id is string => Boolean(id))

          if (ids.length > 0) {
            inReplyTo = ids[ids.length - 1]
            references = ids.join(' ')
          } else {
            console.warn('[gmail] Thread fetched but no Message-ID headers found')
          }
        }
      } catch (err) {
        console.error('[gmail] Thread fetch failed — reply will not be threaded for recipients:', err)
      }
    }

    // ── 4. Encode and send ────────────────────────────────────────────────
    const encodedMessage = this.encodeEmail({
      to: request.to,
      subject: request.subject,
      body: request.body,
      bodyType: request.bodyType ?? 'html',
      messageId: rfc822MessageId,
      inReplyTo,
      references,
      threadTopic: request.threadTopic || request.subject,
      threadIndex,
    })

    const body = {
      raw: encodedMessage,
      ...(request.threadId && { threadId: request.threadId }),
    }

    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        error.error?.message || `Gmail API error: ${response.statusText}`
      )
    }

    const data = (await response.json()) as SendEmailResponse
    const actualRfc822MessageId = await this.fetchActualMessageId(data.id) ?? rfc822MessageId
    return { ...data, rfc822MessageId: actualRfc822MessageId, threadIndex }
  }

  async getThread(threadId: string): Promise<GmailThread> {
    const response = await fetch(
      `${GMAIL_API_BASE}/threads/${threadId}?format=full`,
      { method: 'GET', headers: this.getHeaders() }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch thread: ${response.statusText}`)
    }

    return (await response.json()) as GmailThread
  }

  async getProfile(): Promise<{ emailAddress: string }> {
    const response = await fetch(`${GMAIL_API_BASE}/profile`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`)
    }

    return (await response.json()) as { emailAddress: string }
  }
}

export function createGmailService(accessToken: string): GmailService {
  return new GmailService(accessToken)
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const service = new GmailService(token)
    await service.getProfile()
    return true
  } catch {
    return false
  }
}
