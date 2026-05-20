/**
 * Approve Tasks — task review page (Server Component).
 *
 * Reuses the existing TaskForm + SubtaskEditor + TaskPhotosCard +
 * TaskReceiptsCard components but submits to the approver-specific server
 * actions (updateTaskAsApprover, deleteTaskAsApprover) so the approver
 * can act on tasks they did not create.
 *
 * Sticky footer:
 *   - Approve         — visible when approved_at IS NULL
 *   - Revoke approval — visible when approved_at IS NOT NULL AND status='not_started'
 *   - Delete          — always visible (with confirm prompt)
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canApproveTasks, getCurrentRole } from '@/lib/permissions';
import { ApprovalBadge } from '@/components/ApprovalBadge';
import { TaskForm } from '@/components/TaskForm';
import { SubtaskEditor } from '@/components/SubtaskEditor';
import { TaskPhotosCard } from '@/components/TaskPhotosCard';
import { TaskReceiptsCard } from '@/components/TaskReceiptsCard';
import {
  approveTask,
  revokeApproval,
  updateTaskAsApprover,
  deleteTaskAsApprover,
} from '../actions';
import { ConfirmFormClient } from './ConfirmFormClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legacyId: string }>;
}) {
  const { legacyId } = await params;
  return { title: `Review Task #${legacyId} — OUC Infrastructure Tasks` };
}

function fmtTimestamp(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function ApprovalReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ legacyId: string }>;
  searchParams: Promise<{ error?: string; updated?: string; emailFailed?: string }>;
}) {
  const { legacyId } = await params;
  const sp = await searchParams;
  const n = Number(legacyId);
  if (!Number.isInteger(n) || n < 1) notFound();

  // Authorization
  const role = await getCurrentRole();
  if (!canApproveTasks(role)) {
    redirect('/dashboard?error=Task+Approval+permission+required');
  }

  const supabase = await createClient();

  const { data: task, error: taskErr } = await supabase
    .from('task')
    .select(
      'id, legacy_id, title, description, priority, status, category_id, location_id, contractor_id, assignee_id, due_date, notes, created_by, approved_at, approved_by'
    )
    .eq('legacy_id', n)
    .maybeSingle();

  if (taskErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load task: {taskErr.message}
      </div>
    );
  }
  if (!task) notFound();

  const [
    { data: categories },
    { data: locations },
    { data: contractors },
    { data: users },
    { data: subtasks },
    { data: photos },
    { data: receipts },
    { data: approverProfile },
  ] = await Promise.all([
    supabase.from('category').select('id, name').order('sort_order'),
    supabase.from('location').select('id, name').order('sort_order'),
    supabase.from('contractor').select('id, business_name, active').order('business_name'),
    supabase
      .from('user_profile')
      .select('id, full_name, role, active')
      .in('role', ['admin', 'editor', 'approver'])
      .order('full_name'),
    supabase
      .from('subtask')
      .select('id, sequence, description, labor_cost, equipment_cost, status')
      .eq('task_id', task.id)
      .order('sequence'),
    supabase
      .from('attachment')
      .select('id, filename, caption, storage_path, content_type, uploaded_at')
      .eq('task_id', task.id)
      .eq('type', 'photo')
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('attachment')
      .select('id, filename, vendor, receipt_amount, receipt_date, caption, storage_path, content_type, uploaded_at')
      .eq('task_id', task.id)
      .eq('type', 'receipt')
      .order('receipt_date', { ascending: false, nullsFirst: false })
      .order('uploaded_at', { ascending: false }),
    task.approved_by
      ? supabase
          .from('user_profile')
          .select('full_name')
          .eq('id', task.approved_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isApproved   = !!task.approved_at;
  const canRevokeNow = isApproved && task.status === 'not_started';
  const approverName = approverProfile?.full_name ?? null;

  return (
    <div className="pb-24">
      {/* Breadcrumb */}
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/approvals" className="hover:text-ouc-primary">Approve Tasks</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Task #{task.legacy_id}</span>
      </div>

      {/* Title + approval banner */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ouc-primary">
            Review Task #{task.legacy_id}
          </h1>
          <div className="mt-1 text-[13px] text-ouc-text-muted">
            {task.title}
          </div>
        </div>
        <ApprovalBadge approved={isApproved} size="md" showLabel />
      </div>

      <div
        className={`mb-5 rounded-[10px] border px-4 py-3 text-[13px] ${
          isApproved
            ? 'border-green-200 bg-green-50 text-green-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {isApproved ? (
          <>
            <strong>Approved.</strong>{' '}
            {approverName && <>by {approverName}</>}{' '}
            {task.approved_at && <>on {fmtTimestamp(task.approved_at)}</>}.
            {' '}
            {canRevokeNow ? (
              <em>
                You may revoke approval below — once work begins (status moves
                past Not Started) the approval will lock.
              </em>
            ) : (
              <em>
                Approval is locked because work has begun (status: {task.status.replace('_', ' ')}).
              </em>
            )}
          </>
        ) : (
          <>
            <strong>Awaiting approval.</strong>{' '}
            <em>
              Approving permits the assignee to begin work. Approval does not
              change the task's status.
            </em>
          </>
        )}
      </div>

      {/* Flash messages */}
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}
      {sp.updated && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Saved. The assignee has been notified.
          {sp.emailFailed && (
            <span className="ml-1.5 italic text-amber-700">
              (email notification failed — please follow up manually)
            </span>
          )}
        </div>
      )}

      {/* Edit form */}
      <TaskForm
        action={updateTaskAsApprover}
        defaults={task}
        categories={categories ?? []}
        locations={locations ?? []}
        contractors={contractors ?? []}
        users={users ?? []}
        submitLabel="Save changes"
        isEdit
        cancelHref="/approvals"
      />

      <SubtaskEditor
        subtasks={subtasks ?? []}
        taskId={task.id}
        legacyId={task.legacy_id!}
      />

      <TaskPhotosCard
        photos={(photos ?? []) as any}
        taskId={task.id}
        legacyId={task.legacy_id!}
      />

      <TaskReceiptsCard
        receipts={(receipts ?? []) as any}
        taskId={task.id}
        legacyId={task.legacy_id!}
      />

      {/* Sticky approver actions footer */}
      <ApproverActionsFooter
        taskId={task.id}
        legacyId={task.legacy_id!}
        isApproved={isApproved}
        canRevokeNow={canRevokeNow}
        taskTitle={task.title}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sticky footer with Approve / Revoke / Delete forms.
// Server Component — uses native forms posting to server actions.
// ---------------------------------------------------------------------------

function ApproverActionsFooter({
  taskId,
  legacyId,
  isApproved,
  canRevokeNow,
  taskTitle,
}: {
  taskId: string;
  legacyId: number;
  isApproved: boolean;
  canRevokeNow: boolean;
  taskTitle: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ouc-border bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
        <div className="text-[12.5px] text-ouc-text-muted">
          Approver actions for <span className="font-semibold text-ouc-text">{taskTitle}</span> (#{legacyId})
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isApproved && (
            <form action={approveTask}>
              <input type="hidden" name="id" value={taskId} />
              <button
                type="submit"
                className="cursor-pointer rounded-md bg-green-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green-700"
                title="Approving permits the assignee to begin work. Status is not changed."
              >
                ✅ Approve task
              </button>
            </form>
          )}
          {isApproved && canRevokeNow && (
            <ConfirmFormClient
              action={revokeApproval}
              id={taskId}
              label="⏸️ Revoke approval"
              confirmMessage="Revoking approval will cancel the assignee's permission to start work. Continue?"
              className="cursor-pointer rounded-md border border-amber-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-amber-800 hover:bg-amber-50"
            />
          )}
          <ConfirmFormClient
            action={deleteTaskAsApprover}
            id={taskId}
            label="🗑 Delete task"
            confirmMessage={`Delete "${taskTitle}"? This cannot be undone. The assignee will be notified.`}
            className="cursor-pointer rounded-md border border-red-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50"
          />
        </div>
      </div>
    </div>
  );
}
