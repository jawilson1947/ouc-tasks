/**
 * My Tasks — Server Component.
 * Shows only tasks where assignee_id = current user, grouped by status.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtUSD } from '@/lib/format';
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
};

export default async function MyTasksPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: tasksData, error: tasksErr },
    { data: cats },
    { data: locs },
  ] = await Promise.all([
    supabase
      .from('task_with_totals')
      .select(
        'id, legacy_id, title, priority, status, category_id, location_id, due_date, total_cost, subtask_count, subtask_done_count'
      )
      .eq('assignee_id', user.id)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('category').select('id, name'),
    supabase.from('location').select('id, name'),
  ]);

  if (tasksErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load my tasks:</strong> {tasksErr.message}
      </div>
    );
  }

  const tasks = (tasksData ?? []) as MyTask[];
  const catName = new Map<number, string>((cats ?? []).map((c) => [c.id, c.name]));
  const locName = new Map<number, string>((locs ?? []).map((l) => [l.id, l.name]));

  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const totalOpenCost = open.reduce((sum, t) => sum + Number(t.total_cost), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold text-ouc-primary">My Tasks</h1>
        <div className="text-[13.5px] text-ouc-text-muted">
          {tasks.length === 0
            ? 'You don’t have any tasks assigned to you yet.'
            : `${open.length} open · ${done.length} done · ${fmtUSD(totalOpenCost)} in your queue`}
        </div>
      </div>

      {tasks.length === 0 ? (
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
                              <div className="font-semibold text-ouc-text hover:text-ouc-accent">
                                {t.title}
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
    </div>
  );
}
