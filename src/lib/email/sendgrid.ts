/**
 * Thin SendGrid wrapper. The only place in the app that imports `@sendgrid/mail`.
 *
 * Returns a discriminated result instead of throwing so server actions can
 * fall back gracefully when delivery fails — DB writes must still commit
 * even if the email pipeline is broken.
 *
 * Env vars are read on every call (not captured at module load) so editing
 * .env.local doesn't require killing and restarting the dev server.
 *
 * In local dev with no SENDGRID_API_KEY set, sendEmail() returns
 * { ok: false, error: 'SENDGRID_API_KEY not set' } and the caller
 * continues. This lets `npm run dev` work without forcing every developer
 * to wire up SendGrid.
 */
import sgMail from '@sendgrid/mail';

export type SendEmailResult =
  | { ok: true }
  | { ok: false; error: string };

/** Pull the actionable error string out of a thrown SendGrid response.
 *  The SDK wraps API errors in an `e.response.body.errors[]` array — the
 *  default `e.message` is usually just "Bad Request" which is useless for
 *  diagnosis. */
function formatSendGridError(e: unknown): string {
  if (e == null || typeof e !== 'object') return String(e);
  const err = e as {
    message?: string;
    code?: number | string;
    response?: { body?: { errors?: Array<{ message?: string; field?: string }> } };
  };
  const apiErrors = err.response?.body?.errors;
  if (apiErrors && apiErrors.length > 0) {
    const parts = apiErrors.map((x) =>
      x.field ? `${x.field}: ${x.message ?? '(no message)'}` : (x.message ?? '(no message)')
    );
    const head = err.code != null ? `SendGrid ${err.code}: ` : 'SendGrid: ';
    return head + parts.join('; ');
  }
  return err.message ?? 'unknown SendGrid error';
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'SENDGRID_API_KEY not set' };
  }
  const from = process.env.EMAIL_FROM;
  if (!from) {
    return { ok: false, error: 'EMAIL_FROM not set' };
  }

  // Reset on each call — cheap, and avoids stale keys after env edits.
  sgMail.setApiKey(apiKey);

  const replyTo = process.env.EMAIL_REPLY_TO;

  try {
    await sgMail.send({
      to: args.to,
      from,
      ...(replyTo ? { replyTo } : {}),
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatSendGridError(e) };
  }
}
