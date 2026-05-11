'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function sendResetEmail(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    redirect('/auth/forgot?error=missing');
  }

  // Build an absolute redirectTo so Supabase can send the right callback URL
  // in both local dev and production.
  const headerStore = await headers();
  const host = headerStore.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const redirectTo = `${proto}://${host}/auth/callback?next=/auth/reset`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect('/auth/forgot?error=failed');
  }

  // Always redirect to the "check your email" confirmation screen.
  // Do not reveal whether the email exists in the system.
  redirect('/auth/forgot?sent=1');
}
