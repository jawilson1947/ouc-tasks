'use server';

/**
 * Task Approval — Server Actions.
 *
 *   approveTask(formData)            — set approved_at = now()
 *   revokeApproval(formData)         — null out approval (only when status='not_started')
 *   updateTaskAsApprover(formData)   — full edit, bypasses owner check
 *   deleteTaskAsApprover(formData)   — hard delete
 *
 * Each successful action sends an email to the assignee via SendGrid
 * (best-effort — DB writes commit even if email fails; the redirect
 * carries `?emailFailed=1` so the approver knows).
 *
 * Authorization is gated by `canApproveTasks(role)` (admin or approver).
 * RLS at the database level provides defense in depth.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canApproveTasks, type AppRole } from '@/lib/permissions';
import { readForm, validate } from '../tasks/form-helpers';
import { sendApprovalEmail } from '@/lib/email/sendApprovalEmail';
import type { FieldChange } from '@/lib/email/templates/taskUpdatedByApprover';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function requireApprover() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile?.role ?? null) as AppRole | null;
  if (!canApproveTasks(role)) {
    throw new Error('You need Task Approval permission to do this.');
  }
  return {
    supabase,
    userId: user.id,
    approverName: profile?.full_name ?? user.email ?? 'An approver',
  };
}

type AssigneeSnapshot = {
  email: string | null;
  firstName: string | null;
};

async function fetchAssignee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assigneeId: string | null
): Promise<AssigneeSnapshot> {
  if (!assigneeId) return { email: null, firstName: null };
  const { data } = await supabase
    .from('user_profile')
    .select('email, full_name')
    .eq('id', assigneeId)
    .maybeSingle();
  if (!data) return { email: null, firstName: null };
  const firstName = data.full_name ? data.full_name.split(/\s+/)[0] : null;
  return { email: data.email ?? null, firstName };
}

/** Append an "&emailFailed=1" flag onto a redirect target. */
function withEmailFlag(target: string, ok: boolean): string {
  if (ok) return target;
  return target + (target.includes('?') ? '&' : '?') + 'emailFailed=1';
}

/** Tracked fields for the diff email. */
const DIFF_FIELDS = [
  'title',
  'description',
  'priority',
  'status',
  'category_id',
  'location_id',
  'contractor_id',
  'assignee_id',
  'due_date',
  'notes',
] as const;

function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const k of DIFF_FIELDS) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (a !== b) {
      out[k] = { from: a, to: b };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// approveTask
// ---------------------------------------------------------------------------

export async function approveTask(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  let approverName: string;
  try {
    ({ supabase, userId, approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  const { data: task, error: fetchErr } = await supabase
    .from('task')
    .select('id, legacy_id, title, assignee_id, approved_at')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr || !task) {
    redirect(`/approvals?error=${encodeURIComponent(fetchErr?.message ?? 'Task not found')}`);
  }

  if (task.approved_at) {
    // Idempotent — already approved. Bounce back with a friendly note.
    redirect(`/approvals?error=Task+is+already+approved`);
  }

  const { error: updErr } = await supabase
    .from('task')
    .update({ approved_at: new Date().toISOString(), approved_by: userId })
    .eq('id', id);

  if (updErr) {
    redirect(
      `/approvals/${task.legacy_id ?? ''}?error=${encodeURIComponent(updErr.message)}`
    );
  }

  const assignee = await fetchAssignee(supabase, task.assignee_id);
  const mail = await sendApprovalEmail({
    kind: 'approved',
    to: assignee.email,
    taskTitle: task.title,
    taskLegacyId: task.legacy_id,
    approverName,
    assigneeFirstName: assignee.firstName ?? undefined,
  });

  revalidatePath('/approvals');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  if (task.legacy_id != null) revalidatePath(`/tasks/${task.legacy_id}`);

  redirect(withEmailFlag('/approvals?approved=1', mail.ok));
}

// ---------------------------------------------------------------------------
// revokeApproval
// ---------------------------------------------------------------------------

export async function revokeApproval(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let approverName: string;
  try {
    ({ supabase, approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  const { data: task, error: fetchErr } = await supabase
    .from('task')
    .select('id, legacy_id, title, status, assignee_id, approved_at')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr || !task) {
    redirect(`/approvals?error=${encodeURIComponent(fetchErr?.message ?? 'Task not found')}`);
  }

  if (!task.approved_at) {
    redirect(`/approvals?error=Task+is+not+approved`);
  }

  // Revocation rule: only allowed while status is still 'not_started'.
  // Once work has begun the approval is locked.
  if (task.status !== 'not_started') {
    redirect(
      `/approvals/${task.legacy_id ?? ''}?error=${encodeURIComponent(
        'Approval can only be revoked while a task is Not Started.'
      )}`
    );
  }

  const { error: updErr } = await supabase
    .from('task')
    .update({ approved_at: null, approved_by: null })
    .eq('id', id);

  if (updErr) {
    redirect(
      `/approvals/${task.legacy_id ?? ''}?error=${encodeURIComponent(updErr.message)}`
    );
  }

  const assignee = await fetchAssignee(supabase, task.assignee_id);
  const mail = await sendApprovalEmail({
    kind: 'revoked',
    to: assignee.email,
    taskTitle: task.title,
    taskLegacyId: task.legacy_id,
    approverName,
    assigneeFirstName: assignee.firstName ?? undefined,
  });

  revalidatePath('/approvals');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  if (task.legacy_id != null) revalidatePath(`/tasks/${task.legacy_id}`);

  redirect(withEmailFlag('/approvals?revoked=1', mail.ok));
}

// ---------------------------------------------------------------------------
// updateTaskAsApprover
// ---------------------------------------------------------------------------

export async function updateTaskAsApprover(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let approverName: string;
  try {
    ({ supabase, approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  const legacyIdRaw = String(formData.get('legacy_id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  const fields = readForm(formData);
  const err = validate(fields);
  if (err) {
    redirect(
      `/approvals/${legacyIdRaw}?error=${encodeURIComponent(err)}`
    );
  }

  // Snapshot the row *before* the write so we can build a diff for the email.
  const { data: before } = await supabase
    .from('task')
    .select(
      'title, description, priority, status, category_id, location_id, contractor_id, assignee_id, due_date, notes, assignee_id, legacy_id'
    )
    .eq('id', id)
    .maybeSingle();

  if (!before) {
    redirect(`/approvals?error=Task+not+found`);
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
    redirect(`/approvals/${legacyIdRaw}?error=${encodeURIComponent(error.message)}`);
  }

  // The assignee that receives the email is the NEW assignee, not the old one,
  // because we want to make sure the current owner is aware of the changes.
  const assignee = await fetchAssignee(supabase, fields.assignee_id);
  const diff = buildDiff(
    before as Record<string, unknown>,
    {
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
    }
  );

  const mail = await sendApprovalEmail({
    kind: 'updated',
    to: assignee.email,
    taskTitle: fields.title ?? (before.title as string),
    taskLegacyId: Number(legacyIdRaw) || (before.legacy_id as number | null),
    approverName,
    assigneeFirstName: assignee.firstName ?? undefined,
    changes: diff,
  });

  revalidatePath('/approvals');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  if (legacyIdRaw) revalidatePath(`/tasks/${legacyIdRaw}`);

  redirect(withEmailFlag(`/approvals/${legacyIdRaw}?updated=1`, mail.ok));
}

// ---------------------------------------------------------------------------
// deleteTaskAsApprover
// ---------------------------------------------------------------------------

export async function deleteTaskAsApprover(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let approverName: string;
  try {
    ({ supabase, approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  // Snapshot for the email before we delete.
  const { data: snap } = await supabase
    .from('task')
    .select('title, assignee_id, legacy_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('task').delete().eq('id', id);
  if (error) {
    redirect(`/approvals?error=${encodeURIComponent(error.message)}`);
  }

  let emailOk = true;
  if (snap) {
    const assignee = await fetchAssignee(supabase, snap.assignee_id ?? null);
    const mail = await sendApprovalEmail({
      kind: 'deleted',
      to: assignee.email,
      taskTitle: snap.title as string,
      taskLegacyId: snap.legacy_id as number | null,
      approverName,
      assigneeFirstName: assignee.firstName ?? undefined,
    });
    emailOk = mail.ok;
  }

  revalidatePath('/approvals');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');

  redirect(withEmailFlag('/approvals?deleted=1', emailOk));
}
