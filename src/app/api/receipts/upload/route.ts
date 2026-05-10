import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'receipts';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profile').select('role').eq('id', user.id).maybeSingle();
  if (!['admin', 'editor'].includes(profile?.role ?? ''))
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
      task_id:        taskId,
      type:           'receipt',
      filename:       file.name,
      storage_path:   storagePath,
      content_type:   file.type,
      size_bytes:     file.size,
      caption:        caption || null,
      receipt_amount: parseFloat(amountRaw),
      vendor:         vendor || null,
      receipt_date:   receiptDate || null,
      uploaded_by:    user.id,
    })
    .select('id, storage_path')
    .single();

  if (insErr) {
    await svc.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: att.id, storage_path: att.storage_path });
}
