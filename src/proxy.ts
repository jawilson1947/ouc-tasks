/**
 * Next.js proxy (formerly "middleware") — runs before every matching request.
 * Delegates to the Supabase auth helper so sessions are kept fresh and
 * unauthenticated users are redirected to /login.
 *
 * Renamed from src/middleware.ts in Next 16, where the file convention
 * changed from "middleware" to "proxy". See:
 * https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logos/ (public brand assets)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|logos|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
