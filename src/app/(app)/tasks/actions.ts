'use server';

/**
 * Task CRUD Server Actions: createTask, updateTask, deleteTask.
 *
 * Authorization: admin, editor, and approver can write. Supabase RLS is gone
 * (MySQL has no row-level security), so the rule it used to enforce —
 * "editor can only mutate own tasks; admin and approver may mutate anything"
 * — is now checked explicitly here.
 *
 * Approval semantics: new tasks are always created unapproved
 * (approved_at = NULL). Approval is a separate, explicit action performed
 * via /approvals — even an approver creating a task for themselves must
 * walk over to the approvals queue and click Approve.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, type SessionUser } from '@/lib/auth';
import { readForm, validate } from './form-helpers';
import { sendTaskDoneEmail } from '@/lib/email/sendTaskDoneEmail';
import {
  sendTaskAssignedEmail,
  sendTaskUpdatedEmail,
} from '@/lib/email/sendTaskAssignedEmail';

/** requireRole(), but with the friendly error messages the redirects show. */
async function requireWriter(): Promise<SessionUser> {
  try {
    return await requireRole('admin', 'editor', 'approver');
  } catch (e) {
    if ((e as Error).message === 'Not authenticated') {
      throw new Error('Not authenticated.');
    }
    throw new Error('You need admin, editor, or approver role to manage tasks.');
  }
}

export async function createTask(formData: FormData) {
  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const fields = readForm(formData);
  const err = validate(fields);
  if (err) redirect(`/tasks/new?error=${encodeURIComponent(err)}`);

  // Compute next legacy_id (max + 1) so URLs stay human-readable.
  const { _max } = await prisma.task.aggregate({ _max: { legacyId: true } });
  const nextLegacyId = (_max.legacyId ?? 0) + 1;

  let createdLegacyId: number | null = null;
  let insertErr: string | null = null;
  try {
    const created = await prisma.task.create({
      data: {
        legacyId: nextLegacyId,
        title: fields.title!,
        description: fields.description,
        priority: fields.priority!,
        status: fields.status as TaskStatus,
        categoryId: fields.category_id,
        locationId: fields.location_id,
        contractorId: fields.contractor_id,
        assigneeId: fields.assignee_id,
        dueDate: fields.due_date ? new Date(fields.due_date) : null,
        notes: fields.notes,
        createdById: user.id,
      },
      select: { legacyId: true },
    });
    createdLegacyId = created.legacyId;
  } catch (e) {
    insertErr = e instanceof Error ? e.message : 'Insert failed';
  }

  if (createdLegacyId == null) {
    redirect(`/tasks/new?error=${encodeURIComponent(insertErr ?? 'Insert failed')}`);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');

  // Notify the assignee that they've been assigned this task.
  // Best-effort: DB write already committed, so we never block the redirect.
  if (fields.assignee_id) {
    const taskLegacyId = createdLegacyId;
    (async () => {
      const assignee = await prisma.userProfile.findUnique({
        where: { id: fields.assignee_id! },
        select: { email: true, fullName: true },
      });
      if (assignee?.email) {
        await sendTaskAssignedEmail({
          assigneeEmail: assignee.email,
          assigneeName: assignee.fullName ?? null,
          taskTitle: fields.title ?? '',
          taskLegacyId,
          dueDate: fields.due_date ?? null,
          priority: fields.priority ?? null,
        });
      }
    })().catch((e) =>
      console.error('[email] task-assigned threw unexpectedly:', e)
    );
  }

  redirect(`/tasks/${createdLegacyId}?created=1`);
}

export async function updateTask(formData: FormData) {
  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks?error=${encodeURIComponent((e as Error).message)}`);
  }
  const fullName: string | null = user.name || null;

  const id = String(formData.get('id') ?? '').trim();
  const legacyIdRaw = String(formData.get('legacy_id') ?? '').trim();
  const notifyAssignee = String(formData.get('notify_assignee') ?? '') === 'yes';
  if (!id) redirect('/tasks?error=Missing+task+id');

  const fields = readForm(formData);
  const err = validate(fields);
  if (err) {
    redirect(`/tasks/${legacyIdRaw}/edit?error=${encodeURIComponent(err)}`);
  }

  // Fetch the current status before writing so we can detect a transition to
  // "done" and notify approvers. Also captures title and legacy_id for the email.
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { status: true, title: true, legacyId: true, createdById: true },
  });
  const previousStatus = existing?.status ?? null;

  // Ownership rule formerly enforced by RLS: editors may only mutate their
  // own tasks. Admin and approver may mutate anything.
  if (user.role === 'editor' && existing && existing.createdById !== user.id) {
    redirect(`/tasks/${legacyIdRaw}?error=Editors+can+only+edit+tasks+they+created`);
  }

  // Receipt guard: if the incoming status is "done" and the task has subtasks
  // with equipment costs, at least one receipt must be attached. If the check
  // fails, reset the status to "in_progress" (if it isn't already) and send
  // the user back to the detail page with a clear error — the main update
  // never runs.
  if (fields.status === 'done') {
    const [equipCount, receiptCount] = await Promise.all([
      prisma.subtask.count({
        where: { taskId: id, equipmentCost: { gt: 0 } },
      }),
      prisma.attachment.count({
        where: { taskId: id, type: 'receipt' },
      }),
    ]);

    if (equipCount > 0 && receiptCount === 0) {
      // Reset to in_progress if the task is not already there.
      if (previousStatus !== 'in_progress') {
        await prisma.task.update({
          where: { id },
          data: { status: 'in_progress' },
        });
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

  // When a task is set to Blocked, clear all approval data so it must go
  // through the approval process again once the block is resolved.
  const approvalClear = fields.status === 'blocked'
    ? { approvedAt: null, approvedById: null, requestedApprovalAt: null }
    : {};

  let updateErr: string | null = null;
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
        dueDate: fields.due_date ? new Date(fields.due_date) : null,
        notes: fields.notes,
        ...approvalClear,
      },
    });
  } catch (e) {
    updateErr = e instanceof Error ? e.message : 'Update failed';
  }

  if (updateErr) {
    redirect(`/tasks/${legacyIdRaw}/edit?error=${encodeURIComponent(updateErr)}`);
  }

  // If the editor chose to notify the assignee, send them an update email.
  // Best-effort: DB write already committed.
  if (notifyAssignee && fields.assignee_id && existing) {
    (async () => {
      const assignee = await prisma.userProfile.findUnique({
        where: { id: fields.assignee_id! },
        select: { email: true, fullName: true },
      });
      if (assignee?.email) {
        await sendTaskUpdatedEmail({
          assigneeEmail: assignee.email,
          assigneeName: assignee.fullName ?? null,
          taskTitle: fields.title ?? '',
          taskLegacyId: existing.legacyId,
          dueDate: fields.due_date ?? null,
          priority: fields.priority ?? null,
          updatedByName: fullName?.trim() || null,
        });
      }
    })().catch((e) =>
      console.error('[email] task-updated threw unexpectedly:', e)
    );
  }

  // If the task just became Done, email all active approvers and admins.
  // Best-effort: DB write already succeeded so we never block the redirect.
  if (fields.status === 'done' && previousStatus !== 'done' && existing) {
    const recipientRows = await prisma.userProfile.findMany({
      where: {
        role: { in: ['admin', 'approver'] },
        active: true,
      },
      select: { email: true, fullName: true },
    });

    const recipients = recipientRows
      .filter((r) => r.email.trim() !== '')
      .map((r) => ({ email: r.email, fullName: r.fullName }));

    if (recipients.length > 0) {
      const completedByName = fullName?.trim() || 'A team member';
      sendTaskDoneEmail({
        recipients,
        taskTitle: existing.title,
        taskLegacyId: existing.legacyId,
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
  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/tasks?error=Missing+task+id');

  // Ownership rule formerly enforced by RLS: editors may only delete their
  // own tasks. Admin and approver may delete anything.
  if (user.role === 'editor') {
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { createdById: true },
    });
    if (existing && existing.createdById !== user.id) {
      redirect('/tasks?error=Editors+can+only+delete+tasks+they+created');
    }
  }

  let deleteErr: string | null = null;
  try {
    await prisma.task.delete({ where: { id } });
  } catch (e) {
    deleteErr = e instanceof Error ? e.message : 'Delete failed';
  }
  if (deleteErr) {
    redirect(`/tasks?error=${encodeURIComponent(deleteErr)}`);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/board');
  redirect('/tasks?deleted=1');
}
