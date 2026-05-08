/**
 * POST /auth/signout — sign the current user out and redirect to /login.
 * Wired to the sign-out button in the (app) layout topbar.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL('/login', request.url);
  return NextResponse.redirect(url, { status: 303 });
}
