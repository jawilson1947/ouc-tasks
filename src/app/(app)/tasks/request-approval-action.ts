'use server';

/**
 * requestApproval — fires off "please review this task" emails to every
 * active approver/admin. Triggered by the "Request Approval" button next to
 * Cancel on /tasks/[legacyId]/edit.
 *
 * Semantics:
 *   - Fire-and-forget. No DB write on the task row (no approval_requested_at
 *     column, no migration). Nothing persists beyond the SendGrid call.
 *   - Permission gate matches the edit page: signed-in admin/editor/approver,
 *     and editors must own the task. We re-check here as defense in depth.
 *   - Recipient query: user_profile rows where role in ('admin','approver'),
 *     active = true, email is not null.
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
import { createClient } from '@/lib/supabase/server';
import { fmtUSD } from '@/lib/format';
import { sendApprovalRequestEmail } from '@/lib/email/sendApprovalRequestEmail';

const ROLES_THAT_CAN_REQUEST = new Set(['admin', 'editor', 'approver']);

export async function requestApproval(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const legacyIdRaw = String(formData.get('legacy_id') ?? '').trim();
  if (!id || !legacyIdRaw) {
    redirect('/tasks?error=Missing+task+id');
  }

  const editPath = `/tasks/${legacyIdRaw}/edit`;
  const supabase = await createClient();

  // ── Auth + role check (mirrors the edit page) ────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  const { data: requesterProfile } = await supabase
    .from('user_profile')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const requesterRole = requesterProfile?.role ?? '';
  if (!ROLES_THAT_CAN_REQUEST.has(requesterRole)) {
    redirect(
      `/tasks/${legacyIdRaw}?error=${encodeURIComponent(
        'Admin, editor, or approver role required',
      )}`,
    );
  }

  // ── Load task (with totals) ─────────────────────────────────────────────
  const { data: task, error: taskErr } = await supabase
    .from('task_with_totals')
    .select('id, legacy_id, title, assignee_id, total_cost, created_by')
    .eq('id', id)
    .maybeSingle();

  if (taskErr || !task) {
    redirect(
      `${editPath}?error=${encodeURIComponent(taskErr?.message ?? 'Task not found')}`,
    );
  }

  // Editors can only act on tasks they created — same as edit page.
  if (requesterRole === 'editor' && task.created_by !== user.id) {
    redirect(
      `/tasks/${legacyIdRaw}?error=${encodeURIComponent(
        'Editors can only edit tasks they created',
      )}`,
    );
  }

  // ── Approver / admin recipients ──────────────────────────────────────────
  const { data: recipientRows } = await supabase
    .from('user_profile')
    .select('id, full_name, email')
    .in('role', ['admin', 'approver'])
    .eq('active', true)
    .not('email', 'is', null);

  const recipients = (recipientRows ?? [])
    .filter(
      (r): r is { id: string; full_name: string | null; email: string } =>
        typeof r.email === 'string' && r.email.length > 0,
    )
    .map((r) => ({ email: r.email, fullName: r.full_name }));

  if (recipients.length === 0) {
    // Zero approvers — don't attempt to send. Surface a distinct banner copy
    // via ?noApprovers=1 (matching the same banner styling as the success
    // notice, just different text).
    redirect(`${editPath}?noApprovers=1`);
  }

  // ── Assignee snapshot for the email body ─────────────────────────────────
  let assigneeFullName: string | null = null;
  let assigneeEmail: string | null = null;
  if (task.assignee_id) {
    const { data: assignee } = await supabase
      .from('user_profile')
      .select('full_name, email')
      .eq('id', task.assignee_id)
      .maybeSingle();
    assigneeFullName = assignee?.full_name ?? null;
    assigneeEmail = assignee?.email ?? null;
  }

  // ── Requester attribution ────────────────────────────────────────────────
  const requesterName =
    requesterProfile?.full_name ??
    requesterProfile?.email ??
    user.email ??
    'A user';

  // ── Send ────────────────────────────────────────────────────────────────
  const totalCost =
    typeof task.total_cost === 'number'
      ? task.total_cost
      : Number(task.total_cost ?? 0);
  const plannedBudget = fmtUSD(Number.isFinite(totalCost) ? totalCost : 0);

  const sendResult = await sendApprovalRequestEmail({
    recipients,
    taskTitle: task.title,
    taskLegacyId: task.legacy_id,
    requesterName,
    assigneeFullName,
    assigneeEmail,
    plannedBudget,
  });

  // Revalidate the edit page so the banner shows on the redirected GET.
  revalidatePath(`/tasks/${legacyIdRaw}`);
  revalidatePath(editPath);

  const flags = sendResult.anyFailed
    ? `approversNotified=1&emailFailed=1`
    : `approversNotified=1`;
  redirect(`${editPath}?${flags}`);
}
