/**
 * POST /api/photos/upload — historical path; now serves the unified Attachments
 * card (images + PDFs). The route name is preserved to avoid breaking
 * pre-existing UI references; behaviour fans out by MIME type:
 *   - image/jpeg, image/png, image/webp → attachment_type='photo',  stored under {user}/{task}/photos/
 *   - application/pdf                   → attachment_type='document', stored under {user}/{task}/documents/
 *
 * Size cap is 50 MB (Supabase Storage free-tier per-file limit). Roles allowed
 * to upload: admin, editor, approver.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const BUCKET    = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'receipts';
const MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES    = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set(['application/pdf']);
const WRITER_ROLES   = new Set(['admin', 'editor', 'approver']);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profile').select('role').eq('id', user.id).maybeSingle();
  if (!WRITER_ROLES.has(profile?.role ?? ''))
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

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error: upErr } = await svc.storage
    .from(BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: att, error: insErr } = await svc
    .from('attachment')
    .insert({
      task_id:      taskId,
      type:         attachmentType,
      filename:     file.name,
      storage_path: storagePath,
      content_type: file.type,
      size_bytes:   file.size,
      caption:      caption || null,
      uploaded_by:  user.id,
    })
    .select('id, storage_path')
    .single();

  if (insErr) {
    await svc.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: att.id, storage_path: att.storage_path, type: attachmentType });
}
