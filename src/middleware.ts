/**
 * Next.js Middleware — runs on every matched request before any page renders.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie (keeps auth alive without full page loads).
 *  2. Redirect unauthenticated visitors to /login for any protected route.
 *
 * NOTE: Next.js ONLY recognises this file as middleware when it is named
 * "middleware.ts" (or middleware.js) and exports a function named "middleware".
 * The previous src/proxy.ts with a "proxy" export was silently ignored, which
 * is why auth protection was never running on Vercel.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug header so we can confirm middleware is running in Vercel logs
  console.log(`[middleware] ${request.method} ${pathname}`);

  const response = await updateSession(request);

  // Attach a response header that makes it easy to verify middleware ran
  // (visible in browser DevTools → Network → response headers)
  response.headers.set('x-middleware-ran', '1');
  response.headers.set('x-matched-path', pathname);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every path EXCEPT:
     *   - _next/static  (static assets)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public folder files (logos, images, docs, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|logos|images|docs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
