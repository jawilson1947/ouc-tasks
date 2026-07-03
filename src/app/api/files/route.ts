/**
 * GET /api/files?path=<storagePath> — stream a private Vercel Blob to the
 * browser.
 *
 * The Blob store is PRIVATE, so blobs can't be fetched by URL from the
 * client. attachment.storage_path holds the blob *pathname*
 * ({userId}/{taskId}/photos|documents/{ts}-{name}); this route authenticates
 * the session, fetches the blob server-side with get(..., { access:
 * 'private' }), and streams it back. Same-origin, so <img src> and
 * window.open() work with the session cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const path = request.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  let result;
  try {
    result = await get(path, { access: 'private' });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch file' },
      { status: 500 }
    );
  }
  // get() returns null when the blob doesn't exist; stream is only null on
  // 304 responses (we send no ifNoneMatch, but the check also narrows types).
  if (!result || !result.stream) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const filename = (path.split('/').pop() ?? 'file').replace(/["\\]/g, '_');
  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
