'use server';

/**
 * Server Action: set a new password using a one-time reset token
 * (replaces supabase.auth.updateUser({ password })).
 *
 * The token arrives as hidden form fields (?token=…&email=… from the email
 * link, re-posted by the form). Validation: sha256(raw token) must equal
 * user_profile.reset_token_hash AND reset_token_expires must be in the
 * future. On success the token is cleared (single use), the password is
 * bcrypt-hashed, and email_verified is set — clicking an emailed link
 * proves ownership of the address.
 */

import { createHash } from 'crypto';
import { redirect } from 'next/navigation';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function updatePassword(formData: FormData) {
  const token        = String(formData.get('token') ?? '');
  const email        = String(formData.get('email') ?? '').trim().toLowerCase();
  const password     = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');

  const retryQs = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!token || !email) {
    redirect('/auth/forgot?error=expired');
  }
  if (!password || password.length < 8) {
    redirect(`/auth/reset?${retryQs}&error=weak`);
  }
  if (password !== confirmation) {
    redirect(`/auth/reset?${retryQs}&error=mismatch`);
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = await prisma.userProfile.findUnique({
    where: { email },
    select: { id: true, active: true, resetTokenHash: true, resetTokenExpires: true },
  });

  const valid =
    user != null &&
    user.active &&
    user.resetTokenHash != null &&
    user.resetTokenHash === tokenHash &&
    user.resetTokenExpires != null &&
    user.resetTokenExpires.getTime() > Date.now();

  if (!valid) {
    // Expired, already used, or tampered — send them back for a fresh link.
    redirect('/auth/forgot?error=expired');
  }

  await prisma.userProfile.update({
    where: { id: user!.id },
    data: {
      passwordHash: await hash(password, 10),
      resetTokenHash: null,
      resetTokenExpires: null,
      emailVerified: true, // the link came from their inbox
    },
  });

  redirect('/login?reset=1');
}
