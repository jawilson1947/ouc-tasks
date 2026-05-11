/**
 * GET /auth/callback
 *
 * Handles Supabase PKCE code exchange for:
 *  - Password reset emails  (redirects to /auth/reset)
 *  - OAuth sign-in          (redirects to /dashboard or ?next=)
 *
 * Supabase appends ?code=<one-time-code> to this URL. We exchange it for a
 * real session here on the server so cookies are set before any page renders.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] code exchange failed:', error.message);
      return NextResponse.redirect(`${origin}/login?error=invalid`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
