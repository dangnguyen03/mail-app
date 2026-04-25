import { SendEmailRequest, SendEmailResponse, GmailThread } from './types'

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'

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

  private encodeEmail(to: string, subject: string, body: string, inReplyTo?: string): string {
    const headers: string[] = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0', // Ensure MIME version is set
      'Content-Type: text/html; charset="UTF-8"', // Set content type to HTML
    ]

    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`)
      headers.push(`References: ${inReplyTo}`)
    }

    const emailContent = headers.join('\r\n') + '\r\n\r\n' + body

    // Convert to base64url (RFC 4648)
    const base64 = btoa(unescape(encodeURIComponent(emailContent)))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      // Get the message ID for the In-Reply-To header if replying
      let inReplyTo: string | undefined
      if (request.threadId) {
        try {
          const thread = await this.getThread(request.threadId)
          if (thread.messages && thread.messages.length > 0) {
            inReplyTo = thread.messages[thread.messages.length - 1].id
          }
        } catch (error) {
          console.error('[v0] Failed to get thread for reply:', error)
        }
      }

      const encodedMessage = this.encodeEmail(
        request.to,
        request.subject,
        request.body,
        inReplyTo
      )

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
      return data
    } catch (error) {
      console.error('[v0] Error sending email:', error)
      throw error
    }
  }

  async getThread(threadId: string): Promise<GmailThread> {
    try {
      const response = await fetch(`${GMAIL_API_BASE}/threads/${threadId}?format=full`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch thread: ${response.statusText}`)
      }

      const data = (await response.json()) as GmailThread
      return data
    } catch (error) {
      console.error('[v0] Error getting thread:', error)
      throw error
    }
  }

  async getProfile(): Promise<{ emailAddress: string }> {
    try {
      const response = await fetch(`${GMAIL_API_BASE}/profile`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`)
      }

      const data = (await response.json()) as { emailAddress: string }
      return data
    } catch (error) {
      console.error('[v0] Error getting profile:', error)
      throw error
    }
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
  } catch (error) {
    return false
  }
}
