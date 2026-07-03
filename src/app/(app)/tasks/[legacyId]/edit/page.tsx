/**
 * /tasks/[legacyId]/edit — edit or delete an existing task.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { TaskForm } from '@/components/TaskForm';
import { SubtaskEditor } from '@/components/SubtaskEditor';
import { TaskPhotosCard } from '@/components/TaskPhotosCard';
import { TaskDeleteModal } from '@/components/TaskDeleteModal';
import { RequestApprovalButton } from '@/components/RequestApprovalButton';
import { updateTask, deleteTask } from '../../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legacyId: string }>;
}) {
  const { legacyId } = await params;
  return { title: `Edit Task #${legacyId} — OUC Infrastructure Tasks` };
}

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ legacyId: string }>;
  searchParams: Promise<{
    error?: string;
    approversNotified?: string;
    noApprovers?: string;
    emailFailed?: string;
  }>;
}) {
  const { legacyId } = await params;
  const sp = await searchParams;
  const n = Number(legacyId);
  if (!Number.isInteger(n) || n < 1) notFound();

  // Auth check.
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!['admin', 'editor', 'approver'].includes(user.role)) {
    redirect(`/tasks/${legacyId}?error=Admin%2C+editor%2C+or+approver+role+required`);
  }

  const task = await prisma.task.findUnique({ where: { legacyId: n } });
  if (!task) notFound();

  // Editor can only edit own tasks. Admin can edit any.
  if (user.role === 'editor' && task.createdById !== user.id) {
    redirect(`/tasks/${legacyId}?error=Editors+can+only+edit+tasks+they+created`);
  }

  const [categories, locations, contractorRows, userRows, subtaskRows, photoRows] =
    await Promise.all([
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
        where: { taskId: task.id },
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          description: true,
          laborCost: true,
          equipmentCost: true,
          status: true,
        },
      }),
      prisma.attachment.findMany({
        where: { taskId: task.id, type: { in: ['photo', 'document'] } },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          filename: true,
          caption: true,
          storagePath: true,
          contentType: true,
          uploadedAt: true,
        },
      }),
    ]);

  // Map Prisma results into the snake_case shapes the client components expect.
  const defaults = {
    id: task.id,
    legacy_id: task.legacyId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    category_id: task.categoryId,
    location_id: task.locationId,
    contractor_id: task.contractorId,
    assignee_id: task.assigneeId,
    due_date: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    notes: task.notes,
    requested_approval_at: task.requestedApprovalAt
      ? task.requestedApprovalAt.toISOString()
      : null,
  };

  const contractors = contractorRows.map((c) => ({
    id: c.id,
    business_name: c.businessName,
    active: c.active,
  }));
  const users = userRows.map((u) => ({
    id: u.id,
    full_name: u.fullName,
    role: u.role,
    active: u.active,
  }));
  const subtasks = subtaskRows.map((s) => ({
    id: s.id,
    sequence: s.sequence,
    description: s.description,
    labor_cost: Number(s.laborCost),
    equipment_cost: Number(s.equipmentCost),
    status: s.status,
  }));
  const photos = photoRows.map((p) => ({
    id: p.id,
    filename: p.filename,
    caption: p.caption,
    storage_path: p.storagePath,
    content_type: p.contentType,
    uploaded_at: p.uploadedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/tasks" className="hover:text-ouc-primary">All Tasks</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <Link href={`/tasks/${legacyId}`} className="hover:text-ouc-primary">
          Task #{legacyId}
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Edit</span>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-ouc-primary">
          Edit Task #{task.legacyId}
        </h1>
        <TaskDeleteModal
          taskId={task.id}
          taskTitle={task.title}
          action={deleteTask}
        />
      </div>

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}
      {sp.approversNotified && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Approver(s) have been notified.
          {sp.emailFailed && (
            <span className="ml-1.5 italic text-amber-700">
              (one or more email notifications failed — please follow up manually)
            </span>
          )}
        </div>
      )}
      {sp.noApprovers && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          No approvers exist; request cannot be forwarded.
        </div>
      )}

      <TaskForm
        action={updateTask}
        defaults={defaults}
        categories={categories}
        locations={locations}
        contractors={contractors}
        users={users}
        submitLabel="Save changes"
        isEdit
        cancelHref={`/tasks/${legacyId}`}
        requestApprovalSlot={
          <RequestApprovalButton
            taskId={task.id}
            legacyId={n}
          />
        }
      />

      <SubtaskEditor
        subtasks={subtasks}
        taskId={task.id}
        legacyId={n}
      />

      <TaskPhotosCard
        photos={photos}
        taskId={task.id}
        legacyId={n}
      />
    </div>
  );
}
