'use server';

/**
 * Server Action: sign in via Supabase email + password.
 *
 * Called from the form on src/app/login/page.tsx. On success, redirects to
 * the `next` path (default /dashboard). Users with the 'approver' role are
 * always sent to /approvals regardless of `next` — their primary workflow
 * is the approval queue. On failure, redirects back to /login with an
 * `?error=` flag so the page can render a user-friendly message.
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  let landingPath = next;
  if (data.user) {
    const { data: profile } = await supabase
      .from('user_profile')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    await supabase
      .from('user_profile')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id);

    // Approvers always land on the approval queue.
    if (profile?.role === 'approver') {
      landingPath = '/approvals';
    }
  }

  redirect(landingPath);
}
