'use server';

/**
 * Server Action: request a password-reset link (replaces
 * supabase.auth.resetPasswordForEmail).
 *
 * Scheme (must match the admin invite flow):
 *   raw  = crypto.randomBytes(32).toString('hex')          — 64 hex chars
 *   user_profile.reset_token_hash    = sha256(raw) hex     — 64 hex chars
 *   user_profile.reset_token_expires = now + 2 hours
 *   email link → /auth/reset?token=<raw>&email=<email>
 *
 * Anti-enumeration: always redirects to ?sent=1 whether or not the email
 * matches an active account (and even if SendGrid delivery fails).
 */

import { createHash, randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail';

const RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function sendResetEmail(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    redirect('/auth/forgot?error=missing');
  }

  const user = await prisma.userProfile.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, active: true },
  });

  if (user && user.active) {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');

    await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // Build an absolute link that works in both local dev and production.
    const headerStore = await headers();
    const host = headerStore.get('host') ?? 'localhost:3000';
    const proto = host.startsWith('localhost') ? 'http' : 'https';
    const resetUrl =
      `${proto}://${host}/auth/reset?token=${raw}&email=${encodeURIComponent(user.email)}`;

    // Delivery failures are logged inside the helper; deliberately not
    // surfaced to the requester (no account-existence leak).
    await sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName,
      resetUrl,
    });
  }

  // Always the same outcome for the browser, account or not.
  redirect('/auth/forgot?sent=1');
}
