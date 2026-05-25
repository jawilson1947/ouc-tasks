'use server';

/**
 * Task CRUD Server Actions: createTask, updateTask, deleteTask.
 *
 * Authorization: admin, editor, and approver can write. RLS at the DB
 * enforces "editor can only mutate own tasks"; admin and approver may
 * mutate anything. We re-check here so error messages are friendly.
 *
 * Approval semantics: new tasks are always created unapproved
 * (approved_at = NULL). Approval is a separate, explicit action performed
 * via /approvals — even an approver creating a task for themselves must
 * walk over to the approvals queue and click Approve.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { readForm, validate } from './form-helpers';
import { sendTaskDoneEmail } from '@/lib/email/sendTaskDoneEmail';

const ROLES_THAT_CAN_WRITE = new Set(['admin', 'editor', 'approver']);

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role ?? '';
  if (!ROLES_THAT_CAN_WRITE.has(role)) {
    throw new Error('You need admin, editor, or approver role to manage tasks.');
  }
  return { supabase, userId: user.id, role, fullName: profile?.full_name ?? null };
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
  let fullName: string | null = null;
  try {
    ({ supabase, fullName } = await requireWriter());
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

  // Fetch the current status before writing so we can detect a transition to
  // "done" and notify approvers. Also captures title and legacy_id for the email.
  const { data: existing } = await supabase
    .from('task')
    .select('status, title, legacy_id')
    .eq('id', id)
    .maybeSingle();
  const previousStatus = existing?.status ?? null;

  // Receipt guard: if the incoming status is "done" and the task has subtasks
  // with equipment costs, at least one receipt must be attached. If the check
  // fails, reset the status to "in_progress" (if it isn't already) and send
  // the user back to the detail page with a clear error — the main update
  // never runs.
  if (fields.status === 'done') {
    const [{ count: equipCount }, { count: receiptCount }] = await Promise.all([
      supabase
        .from('subtask')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', id)
        .gt('equipment_cost', 0),
      supabase
        .from('attachment')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', id)
        .eq('type', 'receipt'),
    ]);

    if ((equipCount ?? 0) > 0 && (receiptCount ?? 0) === 0) {
      // Reset to in_progress if the task is not already there.
      if (previousStatus !== 'in_progress') {
        await supabase
          .from('task')
          .update({ status: 'in_progress' })
          .eq('id', id);
        revalidatePath('/tasks');
        revalidatePath('/dashboard');
        revalidatePath('/board');
        revalidatePath(`/tasks/${legacyIdRaw}`);
      }
      redirect(
        `/tasks/${legacyIdRaw}?error=${encodeURIComponent(
          'At least one receipt is required for this task — it has sub-tasks with equipment costs. Please attach a receipt before marking it Done.'
        )}`
      );
    }
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

  // If the task just became Done, email all active approvers and admins.
  // Best-effort: DB write already succeeded so we never block the redirect.
  if (fields.status === 'done' && previousStatus !== 'done' && existing) {
    const { data: recipientRows } = await supabase
      .from('user_profile')
      .select('email, full_name')
      .in('role', ['admin', 'approver'])
      .eq('active', true)
      .not('email', 'is', null);

    const recipients = (recipientRows ?? [])
      .filter((r): r is { email: string; full_name: string | null } =>
        typeof r.email === 'string' && r.email.trim() !== ''
      )
      .map((r) => ({ email: r.email, fullName: r.full_name }));

    if (recipients.length > 0) {
      const completedByName = fullName?.trim() || 'A team member';
      sendTaskDoneEmail({
        recipients,
        taskTitle: existing.title,
        taskLegacyId: existing.legacy_id,
        completedByName,
      }).catch((e) =>
        console.error('[email] task-done fan-out threw unexpectedly:', e)
      );
    }
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
