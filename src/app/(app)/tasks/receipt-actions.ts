'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'receipts';

export async function deleteReceipt(attachmentId: string, legacyId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: att } = await supabase
    .from('attachment')
    .select('id, storage_path, uploaded_by')
    .eq('id', attachmentId)
    .maybeSingle();
  if (!att) throw new Error('Receipt not found');

  const { data: profile } = await supabase
    .from('user_profile').select('role').eq('id', user.id).maybeSingle();
  const isAdmin = profile?.role === 'admin';
  const isOwner = att.uploaded_by === user.id;
  if (!isAdmin && !isOwner) throw new Error('Permission denied');

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  await svc.storage.from(BUCKET).remove([att.storage_path]);
  await svc.from('attachment').delete().eq('id', attachmentId);

  revalidatePath(`/tasks/${legacyId}`);
  revalidatePath('/receipts');
}
