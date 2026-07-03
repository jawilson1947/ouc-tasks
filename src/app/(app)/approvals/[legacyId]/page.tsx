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
import { prisma } from '@/lib/prisma';
import { canApproveTasks, getCurrentRole } from '@/lib/permissions';
import { ApprovalBadge } from '@/components/ApprovalBadge';
import { TaskForm } from '@/components/TaskForm';
import { SubtaskEditor } from '@/components/SubtaskEditor';
import { TaskPhotosCard } from '@/components/TaskPhotosCard';
import { TaskReceiptsCard } from '@/components/TaskReceiptsCard';
import { TaskDeleteModal } from '@/components/TaskDeleteModal';
import { fmtTimestamp } from '@/lib/format';
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

  let taskRow;
  try {
    taskRow = await prisma.task.findUnique({ where: { legacyId: n } });
  } catch (e) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load task: {(e as Error).message}
      </div>
    );
  }
  if (!taskRow) notFound();

  const [
    categoriesRaw,
    locationsRaw,
    contractorsRaw,
    usersRaw,
    subtasksRaw,
    photosRaw,
    receiptsRaw,
    approverProfile,
  ] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.contractor.findMany({
      select: { id: true, businessName: true, active: true },
      orderBy: { businessName: 'asc' },
    }),
    prisma.userProfile.findMany({
      where: { role: { in: ['admin', 'editor', 'approver'] } },
      select: { id: true, fullName: true, role: true, active: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.subtask.findMany({
      where: { taskId: taskRow.id },
      select: {
        id: true,
        sequence: true,
        description: true,
        laborCost: true,
        equipmentCost: true,
        status: true,
      },
      orderBy: { sequence: 'asc' },
    }),
    prisma.attachment.findMany({
      where: { taskId: taskRow.id, type: { in: ['photo', 'document'] } },
      select: {
        id: true,
        filename: true,
        caption: true,
        storagePath: true,
        contentType: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    }),
    prisma.attachment.findMany({
      where: { taskId: taskRow.id, type: 'receipt' },
      select: {
        id: true,
        filename: true,
        vendor: true,
        receiptAmount: true,
        receiptDate: true,
        caption: true,
        storagePath: true,
        contentType: true,
        uploadedAt: true,
      },
      // MySQL sorts NULLs last on DESC — matches the old nullsFirst:false.
      orderBy: [{ receiptDate: 'desc' }, { uploadedAt: 'desc' }],
    }),
    taskRow.approvedById
      ? prisma.userProfile.findUnique({
          where: { id: taskRow.approvedById },
          select: { fullName: true },
        })
      : Promise.resolve(null),
  ]);

  // Map Prisma camelCase rows into the snake_case / plain-value shapes the
  // shared client components (TaskForm, SubtaskEditor, TaskPhotosCard,
  // TaskReceiptsCard) expect.
  const task = {
    id: taskRow.id,
    legacy_id: taskRow.legacyId,
    title: taskRow.title,
    description: taskRow.description,
    priority: taskRow.priority,
    status: taskRow.status as string,
    category_id: taskRow.categoryId,
    location_id: taskRow.locationId,
    contractor_id: taskRow.contractorId,
    assignee_id: taskRow.assigneeId,
    due_date: taskRow.dueDate ? taskRow.dueDate.toISOString().slice(0, 10) : null,
    notes: taskRow.notes,
    created_by: taskRow.createdById,
    approved_at: taskRow.approvedAt ? taskRow.approvedAt.toISOString() : null,
    approved_by: taskRow.approvedById,
    requested_approval_at: taskRow.requestedApprovalAt
      ? taskRow.requestedApprovalAt.toISOString()
      : null,
  };

  const categories = categoriesRaw;
  const locations = locationsRaw;
  const contractors = contractorsRaw.map((c) => ({
    id: c.id,
    business_name: c.businessName,
    active: c.active,
  }));
  const users = usersRaw.map((u) => ({
    id: u.id,
    full_name: u.fullName,
    role: u.role as string,
    active: u.active,
  }));
  const subtasks = subtasksRaw.map((s) => ({
    id: s.id,
    sequence: s.sequence,
    description: s.description,
    labor_cost: Number(s.laborCost),
    equipment_cost: Number(s.equipmentCost),
    status: s.status as string,
  }));
  const photos = photosRaw.map((p) => ({
    id: p.id,
    filename: p.filename,
    caption: p.caption,
    storage_path: p.storagePath,
    content_type: p.contentType,
    uploaded_at: p.uploadedAt.toISOString(),
  }));
  const receipts = receiptsRaw.map((r) => ({
    id: r.id,
    filename: r.filename,
    vendor: r.vendor,
    receipt_amount: r.receiptAmount != null ? Number(r.receiptAmount) : null,
    receipt_date: r.receiptDate ? r.receiptDate.toISOString().slice(0, 10) : null,
    caption: r.caption,
    storage_path: r.storagePath,
    content_type: r.contentType,
    uploaded_at: r.uploadedAt.toISOString(),
  }));

  const isApproved   = !!task.approved_at;
  const canRevokeNow = isApproved && task.status === 'not_started';
  const approverName = approverProfile?.fullName ?? null;

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
        categories={categories}
        locations={locations}
        contractors={contractors}
        users={users}
        submitLabel="Save changes"
        isEdit
        cancelHref="/approvals"
      />

      <SubtaskEditor
        subtasks={subtasks}
        taskId={task.id}
        legacyId={task.legacy_id!}
      />

      <TaskPhotosCard
        photos={photos}
        taskId={task.id}
        legacyId={task.legacy_id!}
      />

      <TaskReceiptsCard
        receipts={receipts}
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
          <TaskDeleteModal
            taskId={taskId}
            taskTitle={taskTitle}
            action={deleteTaskAsApprover}
            triggerLabel="🗑 Delete task"
            triggerClassName="cursor-pointer rounded-md border border-red-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50"
            notice="The assignee will be notified by email. All sub-tasks, photos, and receipts will also be removed."
          />
        </div>
      </div>
    </div>
  );
}
