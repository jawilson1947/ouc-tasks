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

const ROLES_THAT_CAN_WRITE = new Set(['admin', 'editor']);
const VALID_STATUSES = new Set(['not_started', 'in_progress', 'blocked', 'done']);

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

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };
  const intOrNull = (k: string) => {
    const s = get(k);
    if (s == null) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const title       = get('title');
  const description = get('description');
  const priorityN   = intOrNull('priority');
  const status      = get('status');
  const category_id = intOrNull('category_id');
  const location_id = intOrNull('location_id');
  const contractor  = get('contractor_id');
  const assignee    = get('assignee_id');
  const due_date    = get('due_date');
  const notes       = get('notes');

  return {
    title,
    description,
    priority: priorityN,
    status,
    category_id,
    location_id,
    contractor_id: contractor,
    assignee_id: assignee,
    due_date,
    notes,
  };
}

function validate(fields: ReturnType<typeof readForm>): string | null {
  if (!fields.title) return 'Title is required.';
  if (fields.priority == null || fields.priority < 1 || fields.priority > 5) {
    return 'Priority must be 1–5.';
  }
  if (!fields.status || !VALID_STATUSES.has(fields.status)) {
    return 'Pick a valid status.';
  }
  if (fields.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.due_date)) {
    return 'Due date must be YYYY-MM-DD.';
  }
  return null;
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
