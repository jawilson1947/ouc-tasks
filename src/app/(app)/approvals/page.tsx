/**
 * Approve Tasks — queue view (Server Component).
 *
 * Lists every task whose status is not 'done', ordered by priority desc then
 * due_date asc. Only users with Task Approval permission (admin or approver)
 * may reach this route.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canApproveTasks, getCurrentRole } from '@/lib/permissions';
import { ApprovalBadge } from '@/components/ApprovalBadge';
import { Pagination, buildPageHref } from '@/components/Pagination';
import { fmtDate, fmtTimestamp, fmtUSD } from '@/lib/format';
import {
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_DOT,
  PRIORITY_BG,
  categoryBadgeClass,
} from '@/lib/task-display';

const PAGE_SIZE = 6;

export const metadata = { title: 'Approve/Pay Tasks — OUC Infrastructure Tasks' };

type ApprovalRow = {
  id: string;
  legacy_id: number | null;
  title: string;
  priority: number;
  status: string;
  category_id: number | null;
  location_id: number | null;
  due_date: string | null;
  total_cost: number;
  approved_at: string | null;
  requested_approval_at: string | null;
  subtask_count: number;
  subtask_done_count: number;
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    approved?: string;
    revoked?: string;
    updated?: string;
    deleted?: string;
    error?: string;
    emailFailed?: string;
    page?: string;
  }>;
}) {
  const role = await getCurrentRole();
  if (!canApproveTasks(role)) {
    redirect('/dashboard?error=Task+Approval+permission+required');
  }

  const sp = await searchParams;

  // Current page (1-indexed). Bad input clamps to 1.
  const requestedPage = Math.max(1, Number(sp.page) || 1);
  const from = (requestedPage - 1) * PAGE_SIZE;

  let allRows, cats, locs;
  try {
    [allRows, cats, locs] = await Promise.all([
      prisma.taskWithTotals.findMany({
        where: {
          requestedApprovalAt: { not: null },
          status: { notIn: ['blocked', 'closed'] },
        },
      }),
      prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.location.findMany({ select: { id: true, name: true } }),
    ]);
  } catch (e) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load approvals queue:</strong> {(e as Error).message}
      </div>
    );
  }

  // Sort priority desc, then due_date asc with NULLs last (matches the old
  // legacy Postgres ordering — MySQL sorts NULLs first on ASC), then paginate.
  // The queue is small, so fetching all rows and slicing in JS keeps the
  // exact count without a second query.
  allRows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const da = a.dueDate?.getTime() ?? Infinity;
    const db = b.dueDate?.getTime() ?? Infinity;
    return da - db;
  });

  const totalCount = allRows.length;
  const tasks: ApprovalRow[] = allRows.slice(from, from + PAGE_SIZE).map((t) => ({
    id: t.id,
    legacy_id: t.legacyId,
    title: t.title,
    priority: t.priority,
    status: t.status,
    category_id: t.categoryId,
    location_id: t.locationId,
    due_date: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    total_cost: Number(t.totalCost),
    approved_at: t.approvedAt ? t.approvedAt.toISOString() : null,
    requested_approval_at: t.requestedApprovalAt
      ? t.requestedApprovalAt.toISOString()
      : null,
    subtask_count: Number(t.subtaskCount),
    subtask_done_count: Number(t.subtaskDoneCount),
  }));

  const catName = new Map<number, string>(cats.map((c) => [c.id, c.name]));
  const locName = new Map<number, string>(locs.map((l) => [l.id, l.name]));

  // Pagination derived values. The awaiting/approved breakdown that lived
  // here previously was page-scoped (only counted rows in the current slice)
  // and so was dropped — it'd be misleading. An accurate split would require
  // a separate count query; not worth the round-trip for the header text.
  const total       = totalCount;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const showingFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">
            Approve/Pay Tasks
          </h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {total === 0 ? (
              <>No tasks awaiting approval &middot; the queue is clear.</>
            ) : (
              <>
                Showing {showingFrom}&ndash;{showingTo} of {total} task{total === 1 ? '' : 's'} awaiting approval
                {totalPages > 1 && <> &middot; page {currentPage} of {totalPages}</>}
                {' '}&middot; sorted by priority
              </>
            )}
          </div>
        </div>
      </div>

      {/* Flash messages */}
      {sp.error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}
      {sp.approved && (
        <FlashOk message="Task approved. The assignee has been notified." emailFailed={!!sp.emailFailed} />
      )}
      {sp.revoked && (
        <FlashOk message="Approval revoked. The assignee has been notified." emailFailed={!!sp.emailFailed} />
      )}
      {sp.updated && (
        <FlashOk message="Task updated. The assignee has been notified of the changes." emailFailed={!!sp.emailFailed} />
      )}
      {sp.deleted && (
        <FlashOk message="Task deleted. The assignee has been notified." emailFailed={!!sp.emailFailed} />
      )}

      {/* Queue table */}
      <div className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
        {tasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-ouc-text-muted">
            Nothing to approve — no tasks have requested approval yet.
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
                <Th align="center">Approval</Th>
                <Th align="right">Cost</Th>
                <Th>Due</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const category = t.category_id ? catName.get(t.category_id) ?? '—' : '—';
                const location = t.location_id ? locName.get(t.location_id) ?? '—' : '—';
                const reviewHref =
                  t.legacy_id != null ? `/approvals/${t.legacy_id}` : '#';
                return (
                  <tr
                    key={t.id}
                    className="border-b border-ouc-border last:border-b-0 hover:bg-ouc-surface"
                  >
                    <Td>
                      <span
                        className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11.5px] font-bold ${
                          PRIORITY_BG[t.priority] ?? PRIORITY_BG[1]
                        }`}
                      >
                        {t.priority}
                      </span>
                    </Td>
                    <Td>
                      <Link href={reviewHref} className="block">
                        <div className="font-semibold text-ouc-text hover:text-ouc-accent">
                          {t.title}
                        </div>
                        <div className="text-[11.5px] text-ouc-text-muted">
                          {t.subtask_count} sub-task{t.subtask_count === 1 ? '' : 's'}
                          {t.subtask_done_count > 0 && ` · ${t.subtask_done_count} done`}{' '}
                          · #{t.legacy_id ?? '—'}
                        </div>
                        {t.requested_approval_at && (
                          <div className="text-[11.5px] text-ouc-text-muted">
                            Requested on {fmtTimestamp(t.requested_approval_at)}
                          </div>
                        )}
                      </Link>
                    </Td>
                    <Td>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${categoryBadgeClass(
                          category
                        )}`}
                      >
                        {category}
                      </span>
                    </Td>
                    <Td>{location}</Td>
                    <Td>
                      <span
                        className={`text-[12.5px] font-medium ${
                          STATUS_COLOR[t.status] ?? ''
                        }`}
                      >
                        <span
                          className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${
                            STATUS_DOT[t.status] ?? 'bg-ouc-text-muted'
                          }`}
                        />
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </Td>
                    <Td align="center">
                      <ApprovalBadge approved={!!t.approved_at} />
                    </Td>
                    <Td align="right">
                      <span className="font-semibold tabular-nums">
                        {fmtUSD(Number(t.total_cost))}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-ouc-text-muted">{fmtDate(t.due_date)}</span>
                    </Td>
                    <Td align="right">
                      <Link
                        href={reviewHref}
                        className="rounded-md bg-ouc-primary px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-ouc-primary-hover"
                      >
                        {t.status === 'done' ? 'Pay' : 'Approve'}
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination bar — hidden when only one page */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        hrefForPage={(p) => buildPageHref('/approvals', p)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function FlashOk({
  message,
  emailFailed,
}: {
  message: string;
  emailFailed: boolean;
}) {
  return (
    <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
      {message}
      {emailFailed && (
        <span className="ml-1.5 italic text-amber-700">
          (email notification failed — please follow up manually)
        </span>
      )}
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
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      style={width ? { width } : undefined}
      className={`border-b border-ouc-border px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted ${
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left'
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
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={`px-2.5 py-2.5 align-middle ${
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left'
      }`}
    >
      {children}
    </td>
  );
}
