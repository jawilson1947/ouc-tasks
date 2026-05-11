'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password    = String(formData.get('password')    ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');

  if (!password || password.length < 8) {
    redirect('/auth/reset?error=weak');
  }

  if (password !== confirmation) {
    redirect('/auth/reset?error=mismatch');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('[auth/reset] updateUser failed:', error.message);
    redirect('/auth/reset?error=failed');
  }

  // Sign the user out so they start a fresh session with their new password.
  await supabase.auth.signOut();
  redirect('/login?reset=1');
}
