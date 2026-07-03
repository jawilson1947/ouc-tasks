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
 * Authorization: requireRole('admin', 'approver') via requireApprover().
 * MySQL has no row-level security, so this application-layer check is the
 * ONLY gate — every action must call it first.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { readForm, validate } from '../tasks/form-helpers';
import { sendApprovalEmail } from '@/lib/email/sendApprovalEmail';
import type { FieldChange } from '@/lib/email/templates/taskUpdatedByApprover';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function requireApprover(): Promise<{ userId: string; approverName: string }> {
  let user;
  try {
    user = await requireRole('admin', 'approver');
  } catch (e) {
    throw new Error(
      (e as Error).message === 'Not authenticated'
        ? 'Not authenticated.'
        : 'You need Task Approval permission to do this.'
    );
  }
  return {
    userId: user.id,
    approverName: user.name || user.email || 'An approver',
  };
}

type AssigneeSnapshot = {
  email: string | null;
  firstName: string | null;
};

async function fetchAssignee(assigneeId: string | null): Promise<AssigneeSnapshot> {
  if (!assigneeId) return { email: null, firstName: null };
  const data = await prisma.userProfile.findUnique({
    where: { id: assigneeId },
    select: { email: true, fullName: true },
  });
  if (!data) return { email: null, firstName: null };
  const firstName = data.fullName ? data.fullName.split(/\s+/)[0] : null;
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
  let userId: string;
  let approverName: string;
  try {
    ({ userId, approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, legacyId: true, title: true, assigneeId: true, approvedAt: true },
  });
  if (!task) {
    redirect(`/approvals?error=${encodeURIComponent('Task not found')}`);
  }

  if (task.approvedAt) {
    // Idempotent — already approved. Bounce back with a friendly note.
    redirect(`/approvals?error=Task+is+already+approved`);
  }

  let updErr: string | null = null;
  try {
    await prisma.task.update({
      where: { id },
      data: { approvedAt: new Date(), approvedById: userId },
    });
  } catch (e) {
    updErr = (e as Error).message;
  }
  if (updErr) {
    redirect(
      `/approvals/${task.legacyId ?? ''}?error=${encodeURIComponent(updErr)}`
    );
  }

  const assignee = await fetchAssignee(task.assigneeId);
  const mail = await sendApprovalEmail({
    kind: 'approved',
    to: assignee.email,
    taskTitle: task.title,
    taskLegacyId: task.legacyId,
    approverName,
    assigneeFirstName: assignee.firstName ?? undefined,
  });

  revalidatePath('/approvals');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  if (task.legacyId != null) revalidatePath(`/tasks/${task.legacyId}`);

  redirect(withEmailFlag('/approvals?approved=1', mail.ok));
}

// ---------------------------------------------------------------------------
// revokeApproval
// ---------------------------------------------------------------------------

export async function revokeApproval(formData: FormData) {
  let approverName: string;
  try {
    ({ approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      legacyId: true,
      title: true,
      status: true,
      assigneeId: true,
      approvedAt: true,
    },
  });
  if (!task) {
    redirect(`/approvals?error=${encodeURIComponent('Task not found')}`);
  }

  if (!task.approvedAt) {
    redirect(`/approvals?error=Task+is+not+approved`);
  }

  // Revocation rule: only allowed while status is still 'not_started'.
  // Once work has begun the approval is locked.
  if (task.status !== 'not_started') {
    redirect(
      `/approvals/${task.legacyId ?? ''}?error=${encodeURIComponent(
        'Approval can only be revoked while a task is Not Started.'
      )}`
    );
  }

  let updErr: string | null = null;
  try {
    await prisma.task.update({
      where: { id },
      data: { approvedAt: null, approvedById: null },
    });
  } catch (e) {
    updErr = (e as Error).message;
  }
  if (updErr) {
    redirect(
      `/approvals/${task.legacyId ?? ''}?error=${encodeURIComponent(updErr)}`
    );
  }

  const assignee = await fetchAssignee(task.assigneeId);
  const mail = await sendApprovalEmail({
    kind: 'revoked',
    to: assignee.email,
    taskTitle: task.title,
    taskLegacyId: task.legacyId,
    approverName,
    assigneeFirstName: assignee.firstName ?? undefined,
  });

  revalidatePath('/approvals');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  if (task.legacyId != null) revalidatePath(`/tasks/${task.legacyId}`);

  redirect(withEmailFlag('/approvals?revoked=1', mail.ok));
}

// ---------------------------------------------------------------------------
// updateTaskAsApprover
// ---------------------------------------------------------------------------

export async function updateTaskAsApprover(formData: FormData) {
  let approverName: string;
  try {
    ({ approverName } = await requireApprover());
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
  const beforeRow = await prisma.task.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      priority: true,
      status: true,
      categoryId: true,
      locationId: true,
      contractorId: true,
      assigneeId: true,
      dueDate: true,
      notes: true,
      legacyId: true,
    },
  });

  if (!beforeRow) {
    redirect(`/approvals?error=Task+not+found`);
  }

  // Snake_case snapshot with plain values so buildDiff compares like-for-like
  // against the parsed form fields.
  const before = {
    title: beforeRow.title,
    description: beforeRow.description,
    priority: beforeRow.priority,
    status: beforeRow.status as string,
    category_id: beforeRow.categoryId,
    location_id: beforeRow.locationId,
    contractor_id: beforeRow.contractorId,
    assignee_id: beforeRow.assigneeId,
    due_date: beforeRow.dueDate ? beforeRow.dueDate.toISOString().slice(0, 10) : null,
    notes: beforeRow.notes,
    legacy_id: beforeRow.legacyId,
  };

  let updErr: string | null = null;
  try {
    await prisma.task.update({
      where: { id },
      data: {
        title: fields.title!,
        description: fields.description,
        priority: fields.priority!,
        status: fields.status as TaskStatus,
        categoryId: fields.category_id,
        locationId: fields.location_id,
        contractorId: fields.contractor_id,
        assigneeId: fields.assignee_id,
        dueDate: fields.due_date ? new Date(fields.due_date + 'T00:00:00.000Z') : null,
        notes: fields.notes,
      },
    });
  } catch (e) {
    updErr = (e as Error).message;
  }
  if (updErr) {
    redirect(`/approvals/${legacyIdRaw}?error=${encodeURIComponent(updErr)}`);
  }

  // The assignee that receives the email is the NEW assignee, not the old one,
  // because we want to make sure the current owner is aware of the changes.
  const assignee = await fetchAssignee(fields.assignee_id);
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
    taskTitle: fields.title ?? before.title,
    taskLegacyId: Number(legacyIdRaw) || before.legacy_id,
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
  let approverName: string;
  try {
    ({ approverName } = await requireApprover());
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/approvals?error=Missing+task+id');

  // Snapshot for the email before we delete.
  const snap = await prisma.task.findUnique({
    where: { id },
    select: { title: true, assigneeId: true, legacyId: true },
  });

  let delErr: string | null = null;
  try {
    await prisma.task.delete({ where: { id } });
  } catch (e) {
    delErr = (e as Error).message;
  }
  if (delErr) {
    redirect(`/approvals?error=${encodeURIComponent(delErr)}`);
  }

  let emailOk = true;
  if (snap) {
    const assignee = await fetchAssignee(snap.assigneeId ?? null);
    const mail = await sendApprovalEmail({
      kind: 'deleted',
      to: assignee.email,
      taskTitle: snap.title,
      taskLegacyId: snap.legacyId,
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
