/**
 * Dashboard — Server Component.
 *
 * Queries the task_with_totals view plus category/location reference tables,
 * renders the stat cards and the high-priority task list. Visual spec:
 * docs/mockups/dashboard.html. Charts are deferred to a follow-up chunk
 * (Chart.js needs a Client Component wrapper).
 */
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ApprovalBadge } from '@/components/ApprovalBadge';
import { fmtDate, fmtToday } from '@/lib/format';

export const metadata = { title: 'Dashboard — OUC Infrastructure Tasks' };

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  done:        'Done',
  closed:      'Closed',
};

const STATUS_COLOR: Record<string, string> = {
  not_started: 'text-status-not',
  in_progress: 'text-status-prog',
  blocked:     'text-status-blocked',
  done:        'text-status-done',
  closed:      'text-status-closed',
};

const STATUS_DOT: Record<string, string> = {
  not_started: 'bg-status-not',
  in_progress: 'bg-status-prog',
  blocked:     'bg-status-blocked',
  done:        'bg-status-done',
  closed:      'bg-status-closed',
};

const PRIORITY_BG: Record<number, string> = {
  5: 'bg-[#1F2830] text-white',
  4: 'bg-[#424E58] text-white',
  3: 'bg-[#6B7480] text-white',
  2: 'bg-[#9BA1A8] text-white',
  1: 'bg-[#C5C9CE] text-ouc-text',
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

type TaskRow = {
  id: string;
  legacy_id: number | null;
  title: string;
  priority: number;
  status: string;
  category_id: number | null;
  location_id: number | null;
  assignee_id: string | null;
  due_date: string | null;
  total_labor_cost: number;
  total_equipment_cost: number;
  total_cost: number;
  subtask_count: number;
  subtask_done_count: number;
  approved_at: string | null;
};

export default async function DashboardPage() {
  let tasksRaw, cats, locs;
  try {
    [tasksRaw, cats, locs] = await Promise.all([
      prisma.taskWithTotals.findMany({
        where: { status: { not: 'closed' } },
      }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.location.findMany({ select: { id: true, name: true } }),
    ]);
  } catch (e) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load dashboard:</strong> {(e as Error).message}
      </div>
    );
  }

  // Sort: priority desc, then due_date asc with NULLs last (matches the old
  // Supabase `nullsFirst: false` — MySQL sorts NULLs first on ASC, so we
  // sort in JS instead).
  tasksRaw.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const da = a.dueDate?.getTime() ?? Infinity;
    const db = b.dueDate?.getTime() ?? Infinity;
    return da - db;
  });

  // Map Prisma camelCase rows (Decimal/BigInt/Date) into the snake_case
  // plain-value shape the markup below renders.
  const tasks: TaskRow[] = tasksRaw.map((t) => ({
    id: t.id,
    legacy_id: t.legacyId,
    title: t.title,
    priority: t.priority,
    status: t.status,
    category_id: t.categoryId,
    location_id: t.locationId,
    assignee_id: t.assigneeId,
    due_date: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    total_labor_cost: Number(t.totalLaborCost),
    total_equipment_cost: Number(t.totalEquipmentCost),
    total_cost: Number(t.totalCost),
    subtask_count: Number(t.subtaskCount),
    subtask_done_count: Number(t.subtaskDoneCount),
    approved_at: t.approvedAt ? t.approvedAt.toISOString() : null,
  }));

  const catName = new Map<number, string>(cats.map((c) => [c.id, c.name]));
  const locName = new Map<number, string>(locs.map((l) => [l.id, l.name]));

  // Aggregates
  const total = tasks.reduce((sum, t) => sum + Number(t.total_cost), 0);
  const totalLabor = tasks.reduce((sum, t) => sum + Number(t.total_labor_cost), 0);
  const totalEquip = tasks.reduce((sum, t) => sum + Number(t.total_equipment_cost), 0);

  const byStatus = (status: string) => tasks.filter((t) => t.status === status);
  const done = byStatus('done');
  const inProgress = byStatus('in_progress');
  const blocked = byStatus('blocked');
  const notStarted = byStatus('not_started');

  const sumCost = (rows: TaskRow[]) =>
    rows.reduce((sum, r) => sum + Number(r.total_cost), 0);

  const distinctCategories = new Set(
    tasks.map((t) => t.category_id).filter((id): id is number => id != null)
  ).size;

  // High priority: top 6 by priority then due date (already sorted)
  const highPriority = tasks.slice(0, 6);

  const today = fmtToday();

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">Dashboard</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {today} · {tasks.length} task{tasks.length === 1 ? '' : 's'} across{' '}
            {distinctCategories} categor{distinctCategories === 1 ? 'y' : 'ies'}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-ouc-border bg-white px-3.5 py-2 text-[13.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
          >
            Export PDF
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-ouc-border bg-white px-3.5 py-2 text-[13.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <div className="rounded-[10px] border border-ouc-border border-t-[3px] border-t-ouc-primary bg-white px-4 py-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ouc-text-muted">
            Total Backlog
          </div>
          <div className="mt-1 text-2xl font-bold leading-tight text-ouc-text">
            {fmtUSD(total)}
          </div>
          <div className="mt-1 text-xs text-ouc-text-muted">
            {tasks.length} tasks · {fmtUSD(totalLabor)} labor · {fmtUSD(totalEquip)} equipment
          </div>
        </div>

        <StatCard
          label="Done"
          value={done.length}
          valueClass="text-status-done"
          delta={`${fmtUSD(sumCost(done))} closed`}
          deltaClass="text-status-done"
        />
        <StatCard
          label="In Progress"
          value={inProgress.length}
          valueClass="text-status-prog"
          delta={`${fmtUSD(sumCost(inProgress))} in flight`}
        />
        <StatCard
          label="Blocked"
          value={blocked.length}
          valueClass="text-status-blocked"
          delta={blocked.length > 0 ? 'Needs attention' : 'None'}
          deltaClass={blocked.length > 0 ? 'text-status-blocked' : ''}
        />
        <StatCard
          label="Not Started"
          value={notStarted.length}
          delta={`${fmtUSD(sumCost(notStarted))} remaining`}
        />
      </div>

      {/* High-priority task list */}
      <div className="mb-6 rounded-[10px] border border-ouc-border bg-white px-5 py-4.5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-bold text-ouc-primary">
            High Priority Tasks
          </h2>
          <Link href="/tasks" className="text-[12.5px] text-ouc-accent hover:underline">
            View all {tasks.length} →
          </Link>
        </div>

        {highPriority.length === 0 ? (
          <div className="py-6 text-center text-sm text-ouc-text-muted">
            No tasks yet.
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th width={40}>P</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Location</Th>
                <Th>Status</Th>
                <Th align="right">Cost</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody>
              {highPriority.map((t) => {
                const category = t.category_id ? catName.get(t.category_id) ?? '—' : '—';
                const location = t.location_id ? locName.get(t.location_id) ?? '—' : '—';
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-ouc-border last:border-b-0 hover:bg-ouc-surface"
                  >
                    <Td>
                      <span className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11.5px] font-bold ${PRIORITY_BG[t.priority] ?? PRIORITY_BG[1]}`}>
                        {t.priority}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5 font-semibold text-ouc-text">
                        <span>{t.title}</span>
                        <ApprovalBadge approved={!!t.approved_at} />
                      </div>
                      <div className="text-[11.5px] text-ouc-text-muted">
                        {t.subtask_count} sub-task{t.subtask_count === 1 ? '' : 's'} · #{t.legacy_id ?? '—'}
                      </div>
                    </Td>
                    <Td>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${categoryBadgeClass(category)}`}>
                        {category}
                      </span>
                    </Td>
                    <Td>{location}</Td>
                    <Td>
                      <span className={`text-[12.5px] font-medium ${STATUS_COLOR[t.status] ?? ''}`}>
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${STATUS_DOT[t.status] ?? 'bg-ouc-text-muted'}`} />
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-semibold tabular-nums">
                        {fmtUSD(Number(t.total_cost))}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-ouc-text-muted">{fmtDate(t.due_date)}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* TODO: Cost-by-priority and Cost-by-category charts (Chart.js, Client Component) */}
      {/* TODO: Recent activity feed (audit_log query) */}
      {/* TODO: Estimated vs Actual spend (attachments where type='receipt') */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers — kept inline to keep this single-file for the v1 dashboard.
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  valueClass = 'text-ouc-text',
  delta,
  deltaClass = 'text-ouc-text-muted',
}: {
  label: string;
  value: number | string;
  valueClass?: string;
  delta?: string;
  deltaClass?: string;
}) {
  return (
    <div className="rounded-[10px] border border-ouc-border bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-ouc-text-muted">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold leading-tight ${valueClass}`}>
        {value}
      </div>
      {delta && <div className={`mt-1 text-xs ${deltaClass}`}>{delta}</div>}
    </div>
  );
}

function Th({
  children,
  width,
  align = 'left',
}: {
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'right';
}) {
  return (
    <th
      style={width ? { width } : undefined}
      className={`border-b border-ouc-border px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={`px-2.5 py-2.5 align-middle ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </td>
  );
}
