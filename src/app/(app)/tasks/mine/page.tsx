/**
 * My Tasks — Server Component.
 * Shows only tasks where assignee_id = current user, grouped by status.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { ApprovalBadge } from '@/components/ApprovalBadge';
import { Pagination, buildPageHref } from '@/components/Pagination';
import { fmtDate, fmtUSD } from '@/lib/format';

const PAGE_SIZE = 6;
import {
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_COLOR,
  STATUS_DOT,
  PRIORITY_BG,
  categoryBadgeClass,
} from '@/lib/task-display';

export const metadata = { title: 'My Tasks — OUC Infrastructure Tasks' };

type MyTask = {
  id: string;
  legacy_id: number | null;
  title: string;
  priority: number;
  status: string;
  category_id: number | null;
  location_id: number | null;
  due_date: string | null;
  total_cost: number;
  subtask_count: number;
  subtask_done_count: number;
  approved_at: string | null;
};

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect('/login');

  // Current page (1-indexed). Bad input clamps to 1.
  const requestedPage = Math.max(1, Number(sp.page) || 1);

  const [rows, cats, locs] = await Promise.all([
    prisma.taskWithTotals.findMany({
      where: { assigneeId: user.id, status: { not: 'closed' } },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);

  // Sort: priority desc, then due date asc with NULLs last (mirrors the old
  // Supabase `nullsFirst: false`, which MySQL can't express natively). The
  // per-user queue is small, so sorting + paginating in JS is fine.
  rows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const catName = new Map<number, string>(cats.map((c) => [c.id, c.name]));
  const locName = new Map<number, string>(locs.map((l) => [l.id, l.name]));

  // Pagination derived values. The summary/status counts reflect the current
  // page slice rather than the user's whole queue (unchanged behavior).
  const total       = rows.length;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const showingFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(currentPage * PAGE_SIZE, total);

  const tasks: MyTask[] = rows
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    .map((t) => ({
      id: t.id,
      legacy_id: t.legacyId,
      title: t.title,
      priority: t.priority,
      status: t.status,
      category_id: t.categoryId,
      location_id: t.locationId,
      due_date: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      total_cost: Number(t.totalCost),
      subtask_count: Number(t.subtaskCount),
      subtask_done_count: Number(t.subtaskDoneCount),
      approved_at: t.approvedAt ? t.approvedAt.toISOString() : null,
    }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold text-ouc-primary">My Tasks</h1>
        <div className="text-[13.5px] text-ouc-text-muted">
          {total === 0 ? (
            <>You don&rsquo;t have any tasks assigned to you yet.</>
          ) : (
            <>
              Showing {showingFrom}&ndash;{showingTo} of {total} task{total === 1 ? '' : 's'} assigned to you
              {totalPages > 1 && <> &middot; page {currentPage} of {totalPages}</>}
            </>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-[10px] border border-ouc-border bg-white px-6 py-8 text-center shadow-sm">
          <div className="mb-2 text-base font-semibold text-ouc-text">Nothing on your plate</div>
          <p className="mx-auto max-w-md text-[13.5px] text-ouc-text-muted">
            When an admin or staff member assigns a task to you, it&apos;ll show up here.{' '}
            In the meantime, you can browse{' '}
            <Link href="/tasks" className="text-ouc-accent hover:underline">all tasks</Link>{' '}
            to see what&apos;s on the backlog.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {STATUS_ORDER.map((status) => {
            const rows = tasks.filter((t) => t.status === status);
            if (rows.length === 0) return null;
            const subtotal = rows.reduce((sum, t) => sum + Number(t.total_cost), 0);
            return (
              <section
                key={status}
                className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className={`flex items-center gap-2 text-[15px] font-bold ${STATUS_COLOR[status]}`}>
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                    {STATUS_LABEL[status]}
                    <span className="text-ouc-text-muted">({rows.length})</span>
                  </h2>
                  <span className="text-[12.5px] font-semibold tabular-nums text-ouc-text-muted">
                    {fmtUSD(subtotal)}
                  </span>
                </div>
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {rows.map((t) => {
                      const category = t.category_id ? catName.get(t.category_id) ?? '—' : '—';
                      const location = t.location_id ? locName.get(t.location_id) ?? '—' : '—';
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-ouc-border last:border-b-0 hover:bg-ouc-surface"
                        >
                          <td className="w-10 px-2.5 py-2.5">
                            <span
                              className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11.5px] font-bold ${
                                PRIORITY_BG[t.priority] ?? PRIORITY_BG[1]
                              }`}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <Link
                              href={t.legacy_id != null ? `/tasks/${t.legacy_id}` : '#'}
                              className="block"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-ouc-text hover:text-ouc-accent">
                                <span>{t.title}</span>
                                <ApprovalBadge approved={!!t.approved_at} />
                              </div>
                              <div className="text-[11.5px] text-ouc-text-muted">
                                {t.subtask_count} sub-task{t.subtask_count === 1 ? '' : 's'}
                                {t.subtask_done_count > 0 && ` · ${t.subtask_done_count} done`}
                                {' '}· #{t.legacy_id ?? '—'}
                              </div>
                            </Link>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${categoryBadgeClass(
                                category
                              )}`}
                            >
                              {category}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-ouc-text-muted">{location}</td>
                          <td className="px-2.5 py-2.5 text-right">
                            <span className="font-semibold tabular-nums">
                              {fmtUSD(Number(t.total_cost))}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-ouc-text-muted">
                            {fmtDate(t.due_date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}

      {/* Pagination bar — hidden when only one page */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        hrefForPage={(p) => buildPageHref('/tasks/mine', p)}
      />
    </div>
  );
}
