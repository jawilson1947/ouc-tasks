'use server';

/**
 * Task CRUD Server Actions: createTask, updateTask, deleteTask.
 *
 * Authorization: admin and editor can write. RLS at the DB enforces
 * "editor can only mutate own tasks". We re-check here so error messages
 * are friendly.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { readForm, validate } from './form-helpers';

const ROLES_THAT_CAN_WRITE = new Set(['admin', 'editor']);

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role ?? '';
  if (!ROLES_THAT_CAN_WRITE.has(role)) {
    throw new Error('You need admin or editor role to manage tasks.');
  }
  return { supabase, userId: user.id, role };
}

export async function createTask(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    ({ supabase, userId } = await requireWriter());
  } catch (e) {
    redirect(`/tasks/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const fields = readForm(formData);
  const err = validate(fields);
  if (err) redirect(`/tasks/new?error=${encodeURIComponent(err)}`);

  // Compute next legacy_id (max + 1) so URLs stay human-readable.
  const { data: maxRow } = await supabase
    .from('task')
    .select('legacy_id')
    .not('legacy_id', 'is', null)
    .order('legacy_id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextLegacyId = (maxRow?.legacy_id ?? 0) + 1;

  const { data: created, error: insertErr } = await supabase
    .from('task')
    .insert({
      legacy_id: nextLegacyId,
      title: fields.title,
      description: fields.description,
      priority: fields.priority,
      status: fields.status,
      category_id: fields.category_id,
      location_id: fields.location_id,
      contractor_id: fields.contractor_id,
      assignee_id: fields.assignee_id,
      due_date: fields.due_date,
      notes: fields.notes,
      created_by: userId,
    })
    .select('legacy_id')
    .single();

  if (insertErr || !created) {
    redirect(
      `/tasks/new?error=${encodeURIComponent(insertErr?.message ?? 'Insert failed')}`
    );
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  redirect(`/tasks/${created.legacy_id}?created=1`);
}

export async function updateTask(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/tasks?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  const legacyIdRaw = String(formData.get('legacy_id') ?? '').trim();
  if (!id) redirect('/tasks?error=Missing+task+id');

  const fields = readForm(formData);
  const err = validate(fields);
  if (err) {
    redirect(`/tasks/${legacyIdRaw}/edit?error=${encodeURIComponent(err)}`);
  }

  const { error } = await supabase
    .from('task')
    .update({
      title: fields.title,
      description: fields.description,
      priority: fields.priority,
      status: fields.status,
      category_id: fields.category_id,
      location_id: fields.location_id,
      contractor_id: fields.contractor_id,
      assignee_id: fields.assignee_id,
      due_date: fields.due_date,
      notes: fields.notes,
    })
    .eq('id', id);

  if (error) {
    redirect(`/tasks/${legacyIdRaw}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  revalidatePath(`/tasks/${legacyIdRaw}`);
  redirect(`/tasks/${legacyIdRaw}?saved=1`);
}

export async function deleteTask(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/tasks?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/tasks?error=Missing+task+id');

  const { error } = await supabase.from('task').delete().eq('id', id);
  if (error) {
    redirect(`/tasks?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  redirect('/tasks?deleted=1');
}
