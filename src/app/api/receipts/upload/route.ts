/**
 * POST /api/receipts/upload — upload a receipt (image or PDF) for a task.
 *
 * Storage: Vercel Blob, PRIVATE store. put() uses access:'private' and
 * addRandomSuffix:false; the returned *pathname* is persisted in
 * attachment.storage_path and served via the authenticated /api/files route.
 * Roles allowed to upload receipts: admin, editor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!['admin', 'editor'].includes(user.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const fd = await request.formData();
  const file         = fd.get('file')           as File   | null;
  const taskId       = fd.get('task_id')        as string | null;
  const vendor       = fd.get('vendor')         as string | null;
  const amountRaw    = fd.get('receipt_amount') as string | null;
  const receiptDate  = fd.get('receipt_date')   as string | null;
  const caption      = fd.get('caption')        as string | null;

  if (!file)    return NextResponse.json({ error: 'No file provided' },           { status: 400 });
  if (!taskId)  return NextResponse.json({ error: 'task_id required' },           { status: 400 });
  if (!amountRaw || isNaN(parseFloat(amountRaw)))
    return NextResponse.json({ error: 'receipt_amount required' },                { status: 400 });
  if (!ALLOWED.has(file.type))
    return NextResponse.json({ error: `File type not allowed: ${file.type}` },    { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: 'File exceeds 10 MB' },                     { status: 400 });

  const safe        = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${taskId}/${Date.now()}-${safe}`;

  let blobPathname: string;
  try {
    const blob = await put(storagePath, file, {
      access: 'private',
      addRandomSuffix: false,
      contentType: file.type,
    });
    blobPathname = blob.pathname;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }

  try {
    const att = await prisma.attachment.create({
      data: {
        taskId,
        type: 'receipt',
        filename: file.name,
        storagePath: blobPathname,
        contentType: file.type,
        sizeBytes: BigInt(file.size),
        caption: caption || null,
        receiptAmount: parseFloat(amountRaw),
        vendor: vendor || null,
        receiptDate: receiptDate ? new Date(`${receiptDate}T00:00:00.000Z`) : null,
        uploadedById: user.id,
      },
      select: { id: true, storagePath: true },
    });
    return NextResponse.json({ id: att.id, storage_path: att.storagePath });
  } catch (e) {
    // DB insert failed — don't orphan the blob.
    await del(blobPathname).catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save attachment' },
      { status: 500 }
    );
  }
}
