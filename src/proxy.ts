/**
 * Next.js 16 Proxy — runs on every matched request before any page renders.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie (keeps auth alive without full page loads).
 *  2. Redirect unauthenticated visitors to /login for any protected route.
 *
 * The actual redirect logic lives in lib/supabase/middleware.ts.
 */
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[proxy] ${request.method} ${pathname}`);

  const response = await updateSession(request);

  // Visible in browser DevTools → Network → response headers; confirms proxy ran.
  response.headers.set('x-proxy-ran', '1');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logos|images|docs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
