/**
 * Next.js 16 Proxy (formerly Middleware) — runs on every request before any page renders.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie (keeps auth alive without full page loads).
 *  2. Redirect unauthenticated visitors to /login for any protected route.
 *
 * The actual redirect logic lives in lib/supabase/middleware.ts so it can be
 * unit-tested independently of the Next.js proxy signature.
 */
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match every path EXCEPT:
     *   - _next/static  (static assets)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public folder files (logos, images, docs, etc.)
     *
     * This pattern is the one recommended by Supabase SSR docs.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|logos|images|docs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
