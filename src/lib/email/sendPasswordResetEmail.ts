/**
 * Password-reset email — sends a one-time reset link to a user who requested
 * one via /auth/forgot.
 *
 * Parallel to the other send*Email helpers: renders subject/html/text and
 * delegates delivery to the sendgrid.ts wrapper. Never throws — returns the
 * wrapper's discriminated result so the caller can log failures without
 * leaking them to the requester (the forgot flow must not reveal whether an
 * account exists, so it always reports success to the browser).
 *
 * The raw token is embedded in the link; only its sha256 hash is stored in
 * user_profile.reset_token_hash. Links expire after 2 hours (enforced by
 * reset_token_expires, checked in /auth/reset).
 */
import { sendEmail, type SendEmailResult } from './sendgrid';
import { escapeHtml, htmlShell } from './templates/shared';

function firstNameOf(fullName: string | null): string | undefined {
  if (!fullName) return undefined;
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export async function sendPasswordResetEmail(args: {
  to: string;
  fullName: string | null;
  /** Absolute URL to /auth/reset?token=…&email=… (raw token, not the hash). */
  resetUrl: string;
}): Promise<SendEmailResult> {
  const subject = 'Reset your OUC Tasks password';
  const firstName = firstNameOf(args.fullName);
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';

  const text = [
    greeting,
    ``,
    `We received a request to reset the password for your OUC Tasks account.`,
    ``,
    `Set a new password: ${args.resetUrl}`,
    ``,
    `This link expires in 2 hours and can only be used once.`,
    ``,
    `If you didn't request this, you can safely ignore this email — your`,
    `password will not change.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      We received a request to reset the password for your OUC Tasks account.
    </p>
    <p style="margin:18px 0;">
      <a href="${args.resetUrl}" style="display:inline-block;background:#333F48;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;">Set a new password</a>
    </p>
    <p style="margin:0 0 12px;color:#6B7480;">
      This link expires in 2 hours and can only be used once.
    </p>
    <p style="margin:0 0 12px;color:#6B7480;">
      If you didn&#39;t request this, you can safely ignore this email — your
      password will not change.
    </p>
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  const result = await sendEmail({
    to: args.to,
    subject,
    html: htmlShell({ title: subject, bodyHtml }),
    text,
  });

  if (!result.ok) {
    console.error(`[email] password-reset delivery failed for ${args.to}:`, result.error);
  }
  return result;
}
