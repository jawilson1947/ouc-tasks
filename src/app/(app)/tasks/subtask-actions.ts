'use server';

/**
 * Subtask Server Actions — create, update, delete, and status-cycle.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const VALID_STATUSES = new Set(['not_started', 'in_progress', 'done']);

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
  if (!['admin', 'editor'].includes(role)) {
    throw new Error('You need admin or editor role to manage sub-tasks.');
  }
  return { supabase, userId: user.id };
}

/** Bump task.updated_at so the detail page reflects the latest subtask change. */
async function touchTaskUpdatedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
) {
  await supabase
    .from('task')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', taskId);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export async function createSubtask(formData: FormData) {
  const taskId   = String(formData.get('task_id')       ?? '').trim();
  const legacyId = String(formData.get('legacy_id')     ?? '').trim();
  const desc     = String(formData.get('description')   ?? '').trim();
  const labor    = parseFloat(String(formData.get('labor_cost')     ?? '0')) || 0;
  const equip    = parseFloat(String(formData.get('equipment_cost') ?? '0')) || 0;

  if (!taskId || !desc) {
    redirect(`/tasks/${legacyId}/edit?error=Description+is+required`);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }

  const { data: maxRow } = await supabase
    .from('subtask')
    .select('sequence')
    .eq('task_id', taskId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sequence = (maxRow?.sequence ?? 0) + 1;

  const { error } = await supabase.from('subtask').insert({
    task_id: taskId,
    sequence,
    description: desc,
    labor_cost: labor,
    equipment_cost: equip,
  });

  if (error) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await touchTaskUpdatedAt(supabase, taskId);

  revalidatePath(`/tasks/${legacyId}`);
  revalidatePath(`/tasks/${legacyId}/edit`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(`/tasks/${legacyId}/edit`);
}

// ---------------------------------------------------------------------------
// Update (description + costs)
// ---------------------------------------------------------------------------
export async function updateSubtask(formData: FormData) {
  const subtaskId = String(formData.get('subtask_id')   ?? '').trim();
  const legacyId  = String(formData.get('legacy_id')    ?? '').trim();
  const desc      = String(formData.get('description')  ?? '').trim();
  const labor     = parseFloat(String(formData.get('labor_cost')     ?? '0')) || 0;
  const equip     = parseFloat(String(formData.get('equipment_cost') ?? '0')) || 0;

  if (!subtaskId || !desc) {
    redirect(`/tasks/${legacyId}/edit?error=Description+is+required`);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }

  const { error } = await supabase
    .from('subtask')
    .update({ description: desc, labor_cost: labor, equipment_cost: equip })
    .eq('id', subtaskId);

  if (error) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  // Look up parent task and touch its updated_at
  const { data: sub } = await supabase
    .from('subtask').select('task_id').eq('id', subtaskId).maybeSingle();
  if (sub?.task_id) await touchTaskUpdatedAt(supabase, sub.task_id);

  revalidatePath(`/tasks/${legacyId}`);
  revalidatePath(`/tasks/${legacyId}/edit`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(`/tasks/${legacyId}/edit`);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export async function deleteSubtask(formData: FormData) {
  const subtaskId = String(formData.get('subtask_id') ?? '').trim();
  const legacyId  = String(formData.get('legacy_id')  ?? '').trim();

  if (!subtaskId) redirect(`/tasks/${legacyId}/edit?error=Missing+subtask+id`);

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }

  // Fetch parent task_id before deleting (row won't exist after)
  const { data: sub } = await supabase
    .from('subtask').select('task_id').eq('id', subtaskId).maybeSingle();

  const { error } = await supabase.from('subtask').delete().eq('id', subtaskId);

  if (error) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  if (sub?.task_id) await touchTaskUpdatedAt(supabase, sub.task_id);

  revalidatePath(`/tasks/${legacyId}`);
  revalidatePath(`/tasks/${legacyId}/edit`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(`/tasks/${legacyId}/edit`);
}

// ---------------------------------------------------------------------------
// Status update (used from the task detail page interactive checkbox/dropdown)
// ---------------------------------------------------------------------------
export async function updateSubtaskStatus(formData: FormData) {
  const subtaskId = String(formData.get('subtask_id') ?? '').trim();
  const newStatus = String(formData.get('status')      ?? '').trim();
  const legacyId  = String(formData.get('legacy_id')   ?? '').trim();

  if (!subtaskId || !VALID_STATUSES.has(newStatus)) {
    redirect(`/tasks/${legacyId}?error=Invalid+subtask+update`);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    ({ supabase, userId } = await requireWriter());
  } catch (e) {
    redirect(`/tasks/${legacyId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  const payload: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'done') {
    payload.completed_at = new Date().toISOString();
    payload.completed_by = userId;
  } else {
    payload.completed_at = null;
    payload.completed_by = null;
  }

  const { error } = await supabase.from('subtask').update(payload).eq('id', subtaskId);

  if (error) {
    redirect(`/tasks/${legacyId}?error=${encodeURIComponent(error.message)}`);
  }

  // Touch parent task's updated_at
  const { data: sub } = await supabase
    .from('subtask').select('task_id').eq('id', subtaskId).maybeSingle();
  if (sub?.task_id) await touchTaskUpdatedAt(supabase, sub.task_id);

  revalidatePath(`/tasks/${legacyId}`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(`/tasks/${legacyId}`);
}
