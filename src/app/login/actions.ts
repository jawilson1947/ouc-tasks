'use server';

/**
 * Server Action: sign in via Supabase email + password.
 *
 * Called from the form on src/app/login/page.tsx. On success, redirects to
 * the `next` path (or /dashboard). On failure, redirects back to /login with
 * an `?error=` flag so the page can render a user-friendly message.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const SAFE_NEXT_RE = /^\/[^/].*/; // must start with single `/` (no scheme/host injection)

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nextRaw = String(formData.get('next') ?? '/dashboard');
  const next = SAFE_NEXT_RE.test(nextRaw) ? nextRaw : '/dashboard';

  if (!email || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Don't leak which factor failed — Supabase returns "Invalid login credentials"
    // for both wrong-email and wrong-password by design. Pass it through.
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  // Best-effort — don't block login if this fails.
  if (signInData?.user) {
    await supabase
      .from('user_profile')
      .update({ last_login: new Date().toISOString() })
      .eq('id', signInData.user.id);
  }

  redirect(next);
}
