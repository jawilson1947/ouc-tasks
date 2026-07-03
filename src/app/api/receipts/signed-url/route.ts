/**
 * GET /api/receipts/signed-url?path=… — resolve an attachment.storage_path to
 * a browser-loadable URL.
 *
 * The Vercel Blob store is PRIVATE, so storage_path holds the blob *pathname*
 * (not a fetchable URL). We return a same-origin URL to the authenticated
 * streaming route /api/files, which fetches the blob server-side. Same
 * { url } response shape the client components expect, so they don't need to
 * change; same-origin URLs work in <img src> and window.open with the
 * session cookie.
 *
 * Still requires a session — this endpoint shouldn't act as an open
 * path→URL resolver (and /api/files re-checks the session anyway).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const path = request.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  return NextResponse.json({ url: `/api/files?path=${encodeURIComponent(path)}` });
}
