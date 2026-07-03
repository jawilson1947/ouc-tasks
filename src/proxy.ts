/**
 * Next.js 16 Proxy — runs on every matched request before any page renders.
 *
 * Responsibility: redirect unauthenticated visitors to /login for any
 * protected route. Session state lives in the NextAuth JWT cookie, which is
 * verified here without a database round-trip (edge-safe).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/logos',
  '/api/debug',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuthed = Boolean(token?.uid);

  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  // Visible in browser DevTools → Network → response headers; confirms proxy ran.
  response.headers.set('x-proxy-ran', '1');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logos|images|docs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
