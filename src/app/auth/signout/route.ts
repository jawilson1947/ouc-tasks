/**
 * POST /auth/signout — sign the current user out and redirect to /login.
 * Wired to the sign-out button in the (app) layout topbar.
 *
 * NextAuth JWT sessions are stateless, so signing out server-side is just
 * clearing the session cookie (both the dev and the __Secure- production
 * variants).
 */
import { NextResponse } from 'next/server';

const SESSION_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export async function POST(request: Request) {
  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url, { status: 303 });

  for (const name of SESSION_COOKIES) {
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: name.startsWith('__Secure-'),
    });
  }

  return response;
}
