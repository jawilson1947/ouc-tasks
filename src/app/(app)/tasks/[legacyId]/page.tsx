/**
 * Task detail — Server Component, looked up by legacy_id (1..25 from the
 * Word doc). Visual spec: docs/mockups/task-detail.html.
 *
 * V1 scope: header, description, sub-tasks list (read-only), cost summary,
 * details side rail. Sub-task toggling, comments, and attachments are
 * deferred — each needs Server Actions and is its own work chunk.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SubtaskDetailPanel } from '@/components/SubtaskDetailPanel';
import { TaskReceiptsCard } from '@/components/TaskReceiptsCard';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  done:        'Done',
};

const STATUS_PILL: Record<string, string> = {
  not_started: 'bg-status-not/12 text-status-not',
  in_progress: 'bg-status-prog/12 text-status-prog',
  blocked:     'bg-status-blocked/12 text-status-blocked',
  done:        'bg-status-done/12 text-status-done',
};

const STATUS_DOT: Record<string, string> = {
  not_started: 'bg-status-not',
  in_progress: 'bg-status-prog',
  blocked:     'bg-status-blocked',
  done:        'bg-status-done',
};

const PRIORITY_BG: Record<number, string> = {
  5: 'bg-[#1F2830] text-white',
  4: 'bg-[#424E58] text-white',
  3: 'bg-[#6B7480] text-white',
  2: 'bg-[#9BA1A8] text-white',
  1: 'bg-[#C5C9CE] text-ouc-text',
};

const PRIORITY_DESC: Record<number, string> = {
  5: 'P5 — Highest',
  4: 'P4 — High',
  3: 'P3 — Medium',
  2: 'P2 — Low',
  1: 'P1 — Lowest',
};

function categoryBadgeClass(name: string): string {
  if (name.startsWith('Surveillance'))     return 'bg-cat-surveillance/12 text-cat-surveillance';
  if (name.startsWith('Access'))           return 'bg-cat-access/12 text-cat-access';
  if (name.startsWith('AV'))               return 'bg-cat-av/12 text-cat-av';
  if (name.startsWith('Cabling'))          return 'bg-cat-cabling/15 text-amber-700';
  if (name.startsWith('Maintenance'))      return 'bg-cat-maintenance/12 text-cat-maintenance';
  return 'bg-ouc-surface-alt text-ouc-text-muted';
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format a full ISO timestamp (created_at / updated_at). Returns '' for null. */
function fmtTimestamp(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legacyId: string }>;
}) {
  const { legacyId } = await params;
  return { title: `Task #${legacyId} — OUC Infrastructure Tasks` };
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ legacyId: string }>;
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
}) {
  const { legacyId } = await params;
  const sp = await searchParams;
  const n = Number(legacyId);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();

  const [
    { data: task, error: taskErr },
    { data: cats },
    { data: locs },
  ] = await Promise.all([
    supabase
      .from('task_with_totals')
      .select(
        'id, legacy_id, title, description, priority, status, category_id, location_id, contractor_id, assignee_id, due_date, created_at, updated_at, total_labor_cost, total_equipment_cost, total_cost, subtask_count, subtask_done_count'
      )
      .eq('legacy_id', n)
      .maybeSingle(),
    supabase.from('category').select('id, name'),
    supabase.from('location').select('id, name'),
  ]);

  if (taskErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load task:</strong> {taskErr.message}
      </div>
    );
  }
  if (!task) notFound();

  // Fetch sub-tasks with the resolved task UUID, plus the linked contractor (if any).
  const [
    { data: subtasks, error: subErr },
    { data: contractor },
    { data: receipts },
  ] = await Promise.all([
    supabase
      .from('subtask')
      .select('id, sequence, description, labor_cost, equipment_cost, status')
      .eq('task_id', task.id)
      .order('sequence'),
    task.contractor_id
      ? supabase
          .from('contractor')
          .select('id, business_name, primary_first_name, primary_last_name, primary_email, primary_phone, business_phone')
          .eq('id', task.contractor_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('attachment')
      .select('id, filename, vendor, receipt_amount, receipt_date, caption, storage_path, content_type, uploaded_at')
      .eq('task_id', task.id)
      .eq('type', 'receipt')
      .order('receipt_date', { ascending: false, nullsFirst: false })
      .order('uploaded_at', { ascending: false }),
  ]);

  const catName = new Map<number, string>((cats ?? []).map((c) => [c.id, c.name]));
  const locName = new Map<number, string>((locs ?? []).map((l) => [l.id, l.name]));
  const category = task.category_id ? catName.get(task.category_id) ?? '—' : '—';
  const location = task.location_id ? locName.get(task.location_id) ?? '—' : '—';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-2.5 text-[12.5px] text-ouc-text-muted">
        <Link href="/tasks" className="hover:text-ouc-primary">All Tasks</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <Link
          href={`/tasks?category=${task.category_id ?? ''}`}
          className="hover:text-ouc-primary"
        >
          {category}
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Task #{task.legacy_id}</span>
      </div>

      {/* Title row */}
      <div className="mb-2 flex items-start gap-3.5">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            PRIORITY_BG[task.priority] ?? PRIORITY_BG[1]
          }`}
          title={PRIORITY_DESC[task.priority]}
        >
          {task.priority}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-tight text-ouc-primary">
            {task.title}{' '}
            <span className="ml-2 text-sm font-medium text-ouc-text-muted">
              #{task.legacy_id}
            </span>
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                STATUS_PILL[task.status] ?? ''
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${STATUS_DOT[task.status] ?? 'bg-ouc-text-muted'}`}
              />
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${categoryBadgeClass(
                category
              )}`}
            >
              {category}
            </span>
            <span className="self-center text-[12.5px] text-ouc-text-muted">
              📍 {location}
              {task.due_date && ` · Due ${fmtDate(task.due_date)}`}
            </span>
          </div>
        </div>
        <Link
          href={`/tasks/${task.legacy_id}/edit`}
          className="rounded-md border border-ouc-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ouc-text hover:bg-ouc-surface-alt"
        >
          Edit
        </Link>
      </div>

      {/* Flash messages */}
      {sp.error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}
      {sp.created && (
        <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Task created.
        </div>
      )}
      {sp.saved && (
        <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Saved.
        </div>
      )}

      {/* Two-column layout */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Description */}
          <Card title="Description">
            {task.description ? (
              <p className="text-[13.5px] text-ouc-text">{task.description}</p>
            ) : (
              <p className="text-[13.5px] italic text-ouc-text-muted">
                No description provided.
              </p>
            )}
          </Card>

          {/* Sub-tasks */}
          <Card title="Sub-tasks">
            {subErr ? (
              <div className="text-sm text-red-700">
                Failed to load sub-tasks: {subErr.message}
              </div>
            ) : (
              <SubtaskDetailPanel
                subtasks={subtasks ?? []}
                taskId={task.id}
                legacyId={task.legacy_id!}
                totalCost={Number(task.total_cost)}
              />
            )}
          </Card>

          {/* Receipts */}
          <TaskReceiptsCard
            receipts={(receipts ?? []) as any}
            taskId={task.id}
            legacyId={task.legacy_id!}
          />

          {/* TODO: Comments + comment posting — needs Server Action */}
        </div>

        {/* Side rail */}
        <aside className="flex flex-col gap-4">
          <Card title="Details">
            <dl className="flex flex-col gap-3 text-[13px]">
              <DetailRow label="Status">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    STATUS_PILL[task.status] ?? ''
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${STATUS_DOT[task.status] ?? 'bg-ouc-text-muted'}`}
                  />
                  {STATUS_LABEL[task.status] ?? task.status}
                </span>
              </DetailRow>
              <DetailRow label="Priority">
                {PRIORITY_DESC[task.priority] ?? `P${task.priority}`}
              </DetailRow>
              <DetailRow label="Due">
                {task.due_date ? fmtDate(task.due_date) : <span className="text-ouc-text-muted">Not set</span>}
              </DetailRow>
              <DetailRow label="Category">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${categoryBadgeClass(
                    category
                  )}`}
                >
                  {category}
                </span>
              </DetailRow>
              <DetailRow label="Location">{location}</DetailRow>
              <DetailRow label="Contractor">
                {contractor ? (
                  <div>
                    <Link
                      href={`/contractors/${contractor.id}/edit`}
                      className="font-medium text-ouc-accent hover:underline"
                    >
                      {contractor.business_name}
                    </Link>
                    {(contractor.primary_first_name || contractor.primary_last_name) && (
                      <div className="mt-0.5 text-[11.5px] text-ouc-text-muted">
                        {[contractor.primary_first_name, contractor.primary_last_name]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                    )}
                    {(contractor.primary_phone ?? contractor.business_phone) && (
                      <div className="text-[11.5px] text-ouc-text-muted">
                        📞 {contractor.primary_phone ?? contractor.business_phone}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-ouc-text-muted">In-house</span>
                )}
              </DetailRow>
              <DetailRow label="Created">
                {fmtTimestamp(task.created_at) || <span className="text-ouc-text-muted">—</span>}
              </DetailRow>
              <DetailRow label="Updated">
                {fmtTimestamp(task.updated_at) || <span className="text-ouc-text-muted">—</span>}
              </DetailRow>
            </dl>
          </Card>

          <Card title="Cost Summary">
            <div className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex justify-between">
                <span>Labor (estimated)</span>
                <span className="font-semibold tabular-nums">
                  {fmtUSD(Number(task.total_labor_cost))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Equipment (estimated)</span>
                <span className="font-semibold tabular-nums">
                  {fmtUSD(Number(task.total_equipment_cost))}
                </span>
              </div>
              <div className="flex justify-between border-t border-ouc-border pt-2.5 text-[15px] font-bold text-ouc-primary">
                <span>Total estimate</span>
                <span className="tabular-nums">{fmtUSD(Number(task.total_cost))}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local components
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4.5 shadow-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ouc-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2.5">
      <dt className="text-[12px] font-semibold uppercase tracking-wider text-ouc-text-muted">
        {label}
      </dt>
      <dd className="font-medium text-ouc-text">{children}</dd>
    </div>
  );
}
