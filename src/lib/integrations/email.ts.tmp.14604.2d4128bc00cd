import "server-only";

/**
 * Notification email adapter. Swap providers without touching business logic.
 *   EMAIL_PROVIDER=log     (default) write messages to the server log only
 *   EMAIL_PROVIDER=resend  send through Resend (RESEND_API_KEY, EMAIL_FROM)
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

class LogEmailAdapter implements EmailAdapter {
  readonly name = "log";
  async send(message: EmailMessage) {
    console.info(`[email:log] to=${message.to} subject="${message.subject}"`);
  }
}

class ResendEmailAdapter implements EmailAdapter {
  readonly name = "resend";
  constructor(private apiKey: string, private from: string) {}
  async send(message: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}`);
  }
}

export function getEmailAdapter(): EmailAdapter {
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    return new ResendEmailAdapter(process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
  }
  return new LogEmailAdapter();
}
