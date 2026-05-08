/**
 * Board View — Kanban-style by status.
 * Server Component. Drag-and-drop is intentionally deferred (would need
 * a client component + Server Action for status updates).
 */
import Link from 'next/link';
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

export const metadata = { title: 'Board — OUC Infrastructure Tasks' };

type BoardTask = {
  id: string;
  legacy_id: number | null;
  title: string;
  priority: number;
  status: string;
  category_id: number | null;
  location_id: number | null;
  due_date: string | null;
  total_cost: number;
};

export default async function BoardPage() {
  const supabase = await createClient();

  const [
    { data: tasksData, error: tasksErr },
    { data: cats },
    { data: locs },
  ] = await Promise.all([
    supabase
      .from('task_with_totals')
      .select(
        'id, legacy_id, title, priority, status, category_id, location_id, due_date, total_cost'
      )
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('category').select('id, name'),
    supabase.from('location').select('id, name'),
  ]);

  if (tasksErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load board:</strong> {tasksErr.message}
      </div>
    );
  }

  const tasks = (tasksData ?? []) as BoardTask[];
  const catName = new Map<number, string>((cats ?? []).map((c) => [c.id, c.name]));
  const locName = new Map<number, string>((locs ?? []).map((l) => [l.id, l.name]));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">Board</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} grouped by status. Drag-and-drop coming soon.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const rows = tasks.filter((t) => t.status === status);
          const subtotal = rows.reduce((sum, t) => sum + Number(t.total_cost), 0);
          return (
            <div
              key={status}
              className="flex flex-col rounded-[10px] border border-ouc-border bg-white shadow-sm"
            >
              <div className="border-b border-ouc-border px-4 py-3">
                <div className={`flex items-center gap-2 text-[13px] font-bold ${STATUS_COLOR[status]}`}>
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                  {STATUS_LABEL[status]}
                  <span className="ml-auto rounded-full bg-ouc-surface-alt px-2 py-0.5 text-[11px] font-semibold text-ouc-text-muted">
                    {rows.length}
                  </span>
                </div>
                <div className="mt-1 text-[11.5px] tabular-nums text-ouc-text-muted">
                  {fmtUSD(subtotal)}
                </div>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {rows.length === 0 && (
                  <div className="py-4 text-center text-[12.5px] italic text-ouc-text-muted">
                    No tasks
                  </div>
                )}

                {rows.map((t) => {
                  const category = t.category_id ? catName.get(t.category_id) ?? '—' : '—';
                  const location = t.location_id ? locName.get(t.location_id) ?? '—' : '—';
                  return (
                    <Link
                      key={t.id}
                      href={t.legacy_id != null ? `/tasks/${t.legacy_id}` : '#'}
                      className="block rounded-md border border-ouc-border bg-white p-3 transition-shadow hover:border-ouc-accent hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            PRIORITY_BG[t.priority] ?? PRIORITY_BG[1]
                          }`}
                        >
                          {t.priority}
                        </span>
                        <div className="text-[13px] font-semibold leading-snug text-ouc-text">
                          {t.title}
                        </div>
                      </div>

                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${categoryBadgeClass(
                            category
                          )}`}
                        >
                          {category}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11.5px] text-ouc-text-muted">
                        <span>📍 {location}</span>
                        <span className="font-semibold tabular-nums text-ouc-text">
                          {fmtUSD(Number(t.total_cost))}
                        </span>
                      </div>

                      {t.due_date && (
                        <div className="mt-1 text-[11px] text-ouc-text-muted">
                          Due {fmtDate(t.due_date)}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
