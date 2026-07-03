/**
 * POST /api/photos/upload — historical path; now serves the unified Attachments
 * card (images + PDFs). The route name is preserved to avoid breaking
 * pre-existing UI references; behaviour fans out by MIME type:
 *   - image/jpeg, image/png, image/webp → attachment_type='photo',  stored under {user}/{task}/photos/
 *   - application/pdf                   → attachment_type='document', stored under {user}/{task}/documents/
 *
 * Storage: Vercel Blob, PRIVATE store. put() uses access:'private' and
 * addRandomSuffix:false; the returned *pathname* is persisted in
 * attachment.storage_path and served via the authenticated /api/files route.
 * Size cap stays at 50 MB. Roles allowed to upload: admin, editor, approver.
 */
import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES    = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set(['application/pdf']);
const WRITER_ROLES   = new Set(['admin', 'editor', 'approver']);

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!WRITER_ROLES.has(user.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const fd = await request.formData();
  const file    = fd.get('file')    as File   | null;
  const taskId  = fd.get('task_id') as string | null;
  const caption = fd.get('caption') as string | null;

  if (!file)   return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!taskId) return NextResponse.json({ error: 'task_id required' }, { status: 400 });

  const isImage = IMAGE_TYPES.has(file.type);
  const isDoc   = DOCUMENT_TYPES.has(file.type);
  if (!isImage && !isDoc) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type}. Allowed: JPEG, PNG, WebP, PDF.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50 MB' }, { status: 400 });
  }

  const attachmentType: 'photo' | 'document' = isImage ? 'photo' : 'document';
  const folder = isImage ? 'photos' : 'documents';
  const safe   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${taskId}/${folder}/${Date.now()}-${safe}`;

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
        type: attachmentType,
        filename: file.name,
        storagePath: blobPathname,
        contentType: file.type,
        sizeBytes: BigInt(file.size),
        caption: caption || null,
        uploadedById: user.id,
      },
      select: { id: true, storagePath: true },
    });
    return NextResponse.json({ id: att.id, storage_path: att.storagePath, type: attachmentType });
  } catch (e) {
    // DB insert failed — don't orphan the blob.
    await del(blobPathname).catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save attachment' },
      { status: 500 }
    );
  }
}
