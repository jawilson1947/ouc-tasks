'use server';

/**
 * Subtask Server Actions — create, update, delete, and status-cycle.
 *
 * Authorization: admin and editor can write (matching the pre-migration app
 * behavior). Supabase RLS is gone (MySQL), so the ownership rule the old
 * subtask_editor_write policy enforced — editors may only touch sub-tasks of
 * tasks they created — is checked explicitly here.
 *
 * Note: the parent task auto-complete behavior (all sub-tasks done ⇒ task
 * marked done) lives in DB triggers (see mysql_schema.sql), exactly as it
 * did with the Postgres maybe_complete_task trigger — no app logic needed.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SubtaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, type SessionUser } from '@/lib/auth';

const VALID_STATUSES = new Set(['not_started', 'in_progress', 'done']);

/** requireRole(), but with the friendly error messages the redirects show. */
async function requireWriter(): Promise<SessionUser> {
  try {
    return await requireRole('admin', 'editor');
  } catch (e) {
    if ((e as Error).message === 'Not authenticated') {
      throw new Error('Not authenticated.');
    }
    throw new Error('You need admin or editor role to manage sub-tasks.');
  }
}

/**
 * Ownership rule formerly enforced by RLS (subtask_editor_write): editors may
 * only manage sub-tasks of tasks they created. Returns an error message, or
 * null when the write is allowed.
 */
async function editorOwnershipError(
  user: SessionUser,
  taskId: string,
): Promise<string | null> {
  if (user.role !== 'editor') return null;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { createdById: true },
  });
  if (!task || task.createdById !== user.id) {
    return 'Editors can only manage sub-tasks on tasks they created.';
  }
  return null;
}

/** Bump task.updated_at so the detail page reflects the latest subtask change. */
async function touchTaskUpdatedAt(taskId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { updatedAt: new Date() },
  });
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

  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }

  const denied = await editorOwnershipError(user, taskId);
  if (denied) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(denied)}`);
  }

  const maxRow = await prisma.subtask.findFirst({
    where: { taskId },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });
  const sequence = (maxRow?.sequence ?? 0) + 1;

  let insertErr: string | null = null;
  try {
    await prisma.subtask.create({
      data: {
        taskId,
        sequence,
        description: desc,
        laborCost: labor,
        equipmentCost: equip,
      },
    });
  } catch (e) {
    insertErr = e instanceof Error ? e.message : 'Insert failed';
  }

  if (insertErr) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(insertErr)}`);
  }

  await touchTaskUpdatedAt(taskId);

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

  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }

  // Look up the parent task for the ownership check + updated_at touch.
  const sub = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true },
  });
  if (!sub) redirect(`/tasks/${legacyId}/edit?error=Sub-task+not+found`);

  const denied = await editorOwnershipError(user, sub.taskId);
  if (denied) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(denied)}`);
  }

  let updateErr: string | null = null;
  try {
    await prisma.subtask.update({
      where: { id: subtaskId },
      data: { description: desc, laborCost: labor, equipmentCost: equip },
    });
  } catch (e) {
    updateErr = e instanceof Error ? e.message : 'Update failed';
  }

  if (updateErr) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(updateErr)}`);
  }

  await touchTaskUpdatedAt(sub.taskId);

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

  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }

  // Fetch parent task_id before deleting (row won't exist after).
  const sub = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true },
  });
  if (!sub) redirect(`/tasks/${legacyId}/edit?error=Sub-task+not+found`);

  const denied = await editorOwnershipError(user, sub.taskId);
  if (denied) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(denied)}`);
  }

  let deleteErr: string | null = null;
  try {
    await prisma.subtask.delete({ where: { id: subtaskId } });
  } catch (e) {
    deleteErr = e instanceof Error ? e.message : 'Delete failed';
  }

  if (deleteErr) {
    redirect(`/tasks/${legacyId}/edit?error=${encodeURIComponent(deleteErr)}`);
  }

  await touchTaskUpdatedAt(sub.taskId);

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

  let user: SessionUser;
  try {
    user = await requireWriter();
  } catch (e) {
    redirect(`/tasks/${legacyId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  const sub = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true },
  });
  if (!sub) redirect(`/tasks/${legacyId}?error=Sub-task+not+found`);

  const denied = await editorOwnershipError(user, sub.taskId);
  if (denied) {
    redirect(`/tasks/${legacyId}?error=${encodeURIComponent(denied)}`);
  }

  const done = newStatus === 'done';

  let updateErr: string | null = null;
  try {
    // Completing the last sub-task auto-completes the parent task via the DB
    // trigger (same behavior as the old Postgres maybe_complete_task trigger).
    await prisma.subtask.update({
      where: { id: subtaskId },
      data: {
        status: newStatus as SubtaskStatus,
        completedAt: done ? new Date() : null,
        completedById: done ? user.id : null,
      },
    });
  } catch (e) {
    updateErr = e instanceof Error ? e.message : 'Update failed';
  }

  if (updateErr) {
    redirect(`/tasks/${legacyId}?error=${encodeURIComponent(updateErr)}`);
  }

  // Touch parent task's updated_at
  await touchTaskUpdatedAt(sub.taskId);

  revalidatePath(`/tasks/${legacyId}`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(`/tasks/${legacyId}`);
}
