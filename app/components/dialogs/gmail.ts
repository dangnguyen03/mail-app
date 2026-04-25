interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export class GmailService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private createEmailMessage(params: SendEmailParams): string {
    const { to, subject, body } = params;
    const message = [
      `Content-Type: text/html; charset="UTF-8"`,
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body,
    ].join('\n');

    return btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async sendEmail(params: SendEmailParams): Promise<{ id: string; threadId: string }> {
    const raw = this.createEmailMessage(params);
    const body: { raw: string; threadId?: string } = { raw };
    if (params.threadId) {
      body.threadId = params.threadId;
    }

    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gmail API error: ${error.error.message}`);
    }

    return response.json();
  }

  // Other methods like validateToken would go here
}

// Assuming validateToken is also part of this service from TokenDialog.tsx
export async function validateToken(token: string): Promise<boolean> {
  const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}