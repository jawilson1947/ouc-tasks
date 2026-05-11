/**
 * GET /api/debug
 *
 * Public diagnostic endpoint — no auth required.
 * Returns a JSON snapshot of the runtime environment so we can confirm
 * that Vercel env vars are wired up and the app is reachable.
 *
 * REMOVE THIS ROUTE once the 404 issue is resolved.
 */
import { NextResponse } from 'next/server';

function present(val: string | undefined) {
  if (!val) return 'MISSING';
  if (val.length < 8) return 'TOO_SHORT';
  return `set (${val.length} chars, starts "${val.slice(0, 4)}…")`;
}

export async function GET(request: Request) {
  const { searchParams, pathname, host } = new URL(request.url);

  const payload = {
    ok: true,
    timestamp: new Date().toISOString(),
    runtime: {
      nodeVersion: process.version,
      nextVersion: process.env.NEXT_RUNTIME ?? 'unknown',
      vercelEnv: process.env.VERCEL_ENV ?? 'not-vercel',
      vercelRegion: process.env.VERCEL_REGION ?? 'unknown',
    },
    request: {
      host,
      pathname,
      method: request.method,
      // show which x-forwarded headers Vercel injected
      xForwardedFor: request.headers.get('x-forwarded-for') ?? 'none',
      xForwardedProto: request.headers.get('x-forwarded-proto') ?? 'none',
      xMiddlewareRan: request.headers.get('x-middleware-ran') ?? 'NO — middleware did not run',
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL:      present(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      // Server-only vars (never exposed to the browser)
      SUPABASE_SERVICE_ROLE_KEY:     present(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  };

  return NextResponse.json(payload, {
    headers: { 'cache-control': 'no-store' },
  });
}
