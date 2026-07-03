'use server';

/**
 * requestApproval — fires off "please review this task" emails to every
 * active approver/admin. Triggered by the "Request Approval" button next to
 * Cancel on /tasks/[legacyId]/edit.
 *
 * Semantics:
 *   - On a successful send (at least one approver email accepted by SendGrid)
 *     we stamp `task.requested_approval_at = now()`. Re-clicking overwrites
 *     the prior timestamp — no preserve-first-only, no throttle. If the send
 *     fails entirely, or if there were zero approvers to send to, the column
 *     is left untouched. Approval (later) does NOT clear the column.
 *   - Permission gate matches the edit page: signed-in admin/editor/approver,
 *     and editors must own the task. MySQL has no RLS, so this check is the
 *     only gate — requireRole() runs before anything else.
 *   - Recipient query: user_profile rows where role in ('admin','approver'),
 *     active = true, email non-empty.
 *   - Empty recipient list → redirect with ?noApprovers=1 (no send attempt).
 *   - One email per recipient (no BCC), matching sendApprovalEmail.ts.
 *   - Any SendGrid failure → redirect with the extra &emailFailed=1 flag,
 *     same convention as the approver actions.
 *
 * Budget figure: pulled from the task_with_totals view (total_cost =
 * labor + equipment, receipts excluded). Formatted as USD.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole, type SessionUser } from '@/lib/auth';
import { fmtUSD } from '@/lib/format';
import { sendApprovalRequestEmail } from '@/lib/email/sendApprovalRequestEmail';

export async function requestApproval(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const legacyIdRaw = String(formData.get('legacy_id') ?? '').trim();
  if (!id || !legacyIdRaw) {
    redirect('/tasks?error=Missing+task+id');
  }

  const editPath = `/tasks/${legacyIdRaw}/edit`;

  // ── Auth + role check (mirrors the edit page) ────────────────────────────
  let user: SessionUser;
  try {
    user = await requireRole('admin', 'editor', 'approver');
  } catch (e) {
    if ((e as Error).message === 'Not authenticated') {
      redirect('/login');
    }
    redirect(
      `/tasks/${legacyIdRaw}?error=${encodeURIComponent(
        'Admin, editor, or approver role required',
      )}`,
    );
  }

  // ── Load task (with totals) ─────────────────────────────────────────────
  let task;
  try {
    task = await prisma.taskWithTotals.findUnique({
      where: { id },
      select: {
        id: true,
        legacyId: true,
        title: true,
        assigneeId: true,
        totalCost: true,
        createdById: true,
      },
    });
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent((e as Error).message)}`);
  }

  if (!task) {
    redirect(`${editPath}?error=${encodeURIComponent('Task not found')}`);
  }

  // Editors can only act on tasks they created — same as edit page.
  if (user.role === 'editor' && task.createdById !== user.id) {
    redirect(
      `/tasks/${legacyIdRaw}?error=${encodeURIComponent(
        'Editors can only edit tasks they created',
      )}`,
    );
  }

  // ── Approver / admin recipients ──────────────────────────────────────────
  const recipientRows = await prisma.userProfile.findMany({
    where: {
      role: { in: ['admin', 'approver'] },
      active: true,
    },
    select: { id: true, fullName: true, email: true },
  });

  const recipients = recipientRows
    .filter((r) => typeof r.email === 'string' && r.email.length > 0)
    .map((r) => ({ email: r.email, fullName: r.fullName }));

  if (recipients.length === 0) {
    // Zero approvers — don't attempt to send. Surface a distinct banner copy
    // via ?noApprovers=1 (matching the same banner styling as the success
    // notice, just different text).
    redirect(`${editPath}?noApprovers=1`);
  }

  // ── Assignee snapshot for the email body ─────────────────────────────────
  let assigneeFullName: string | null = null;
  let assigneeEmail: string | null = null;
  if (task.assigneeId) {
    const assignee = await prisma.userProfile.findUnique({
      where: { id: task.assigneeId },
      select: { fullName: true, email: true },
    });
    assigneeFullName = assignee?.fullName ?? null;
    assigneeEmail = assignee?.email ?? null;
  }

  // ── Requester attribution ────────────────────────────────────────────────
  const requesterName = user.name || user.email || 'A user';

  // ── Send ────────────────────────────────────────────────────────────────
  const totalCost = Number(task.totalCost ?? 0);
  const plannedBudget = fmtUSD(Number.isFinite(totalCost) ? totalCost : 0);

  const sendResult = await sendApprovalRequestEmail({
    recipients,
    taskTitle: task.title,
    taskLegacyId: task.legacyId,
    requesterName,
    assigneeFullName,
    assigneeEmail,
    plannedBudget,
  });

  // Persist the request timestamp ONLY when at least one email was accepted
  // by SendGrid. okCount === 0 covers both "send blew up entirely" and the
  // (already short-circuited above) "no approvers existed" case. Re-clicks
  // overwrite by design — the column reflects the most recent successful
  // request, not the first one.
  if (sendResult.okCount > 0) {
    const legacyIdNum = Number(legacyIdRaw);
    if (Number.isInteger(legacyIdNum)) {
      try {
        await prisma.task.update({
          where: { legacyId: legacyIdNum },
          data: { requestedApprovalAt: new Date() },
        });
      } catch (stampErr) {
        // Best-effort: the email already went out, so we don't fail the whole
        // action. Log and continue so the banner still surfaces.
        console.error(
          `[request-approval] failed to stamp requested_approval_at on task ${legacyIdNum}:`,
          stampErr,
        );
      }
    }
  }

  // Revalidate the edit page so the banner shows on the redirected GET.
  revalidatePath(`/tasks/${legacyIdRaw}`);
  revalidatePath(editPath);

  const flags = sendResult.anyFailed
    ? `approversNotified=1&emailFailed=1`
    : `approversNotified=1`;
  redirect(`${editPath}?${flags}`);
}
