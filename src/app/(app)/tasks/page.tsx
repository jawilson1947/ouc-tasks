/**
 * All Tasks — Server Component.
 *
 * Lists every task the user can see (RLS handles visibility). Supports
 * URL-driven filtering: ?q=<text>&status=<status>&priority=<n>&category=<id>.
 * Filter chips at the top toggle each filter on/off via Links.
 * Visual reference: docs/mockups/dashboard.html (table styling).
 */
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'All Tasks — OUC Infrastructure Tasks' };

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  done:        'Done',
};

const STATUS_ORDER = ['not_started', 'in_progress', 'blocked', 'done'] as const;

const STATUS_COLOR: Record<string, string> = {
  not_started: 'text-status-not',
  in_progress: 'text-status-prog',
  blocked:     'text-status-blocked',
  done:        'text-status-done',
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
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

type TaskRow = {
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

type SearchParams = {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
};

/**
 * Build a /tasks?... href that flips one filter while preserving the rest.
 * If `value` matches the current value, the filter is cleared (toggle off).
 */
function buildHref(
  current: SearchParams,
  key: keyof SearchParams,
  value: string | undefined
): string {
  const next = { ...current };
  if (value === undefined || current[key] === value) {
    delete next[key];
  } else {
    next[key] = value;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `/tasks?${s}` : '/tasks';
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Build the query with the active filters applied server-side.
  let q = supabase
    .from('task_with_totals')
    .select(
      'id, legacy_id, title, priority, status, category_id, location_id, due_date, total_cost, subtask_count, subtask_done_count'
    );

  if (params.q && params.q.trim()) {
    q = q.ilike('title', `%${params.q.trim()}%`);
  }
  if (params.status && STATUS_ORDER.includes(params.status as typeof STATUS_ORDER[number])) {
    q = q.eq('status', params.status);
  }
  if (params.priority && /^[1-5]$/.test(params.priority)) {
    q = q.eq('priority', Number(params.priority));
  }
  if (params.category && /^\d+$/.test(params.category)) {
    q = q.eq('category_id', Number(params.category));
  }

  const [
    { data: tasksData, error: tasksErr },
    { data: cats },
    { data: locs },
  ] = await Promise.all([
    q
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('category').select('id, name').order('sort_order'),
    supabase.from('location').select('id, name'),
  ]);

  if (tasksErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load tasks:</strong> {tasksErr.message}
      </div>
    );
  }

  const tasks = (tasksData ?? []) as TaskRow[];
  const categories = cats ?? [];
  const catName = new Map<number, string>(categories.map((c) => [c.id, c.name]));
  const locName = new Map<number, string>((locs ?? []).map((l) => [l.id, l.name]));

  const filterCount =
    (params.q ? 1 : 0) +
    (params.status ? 1 : 0) +
    (params.priority ? 1 : 0) +
    (params.category ? 1 : 0);

  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">All Tasks</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
            {filterCount > 0 && (
              <>
                {' '}matching {filterCount} filter{filterCount === 1 ? '' : 's'}{' '}
                <Link href="/tasks" className="text-ouc-accent hover:underline">
                  Clear
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <form
        action="/tasks"
        method="get"
        className="mb-3 flex max-w-xl items-center gap-2"
      >
        {/* preserve other filters as hidden inputs */}
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.priority && <input type="hidden" name="priority" value={params.priority} />}
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search task titles…"
          className="flex-1 rounded-lg border border-ouc-border bg-white px-3 py-2 text-[13.5px] text-ouc-text focus:border-ouc-accent focus:outline-none focus:ring-3 focus:ring-ouc-accent/20"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-lg border border-ouc-border bg-white px-3.5 py-2 text-[13.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
        >
          Search
        </button>
      </form>

      {/* Filter chip rows */}
      <div className="mb-5 flex flex-col gap-2 text-[12.5px]">
        <ChipRow label="Status">
          {STATUS_ORDER.map((s) => (
            <Chip
              key={s}
              href={buildHref(params, 'status', s)}
              active={params.status === s}
            >
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="Priority">
          {[5, 4, 3, 2, 1].map((p) => (
            <Chip
              key={p}
              href={buildHref(params, 'priority', String(p))}
              active={params.priority === String(p)}
            >
              P{p}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="Category">
          {categories.map((c) => (
            <Chip
              key={c.id}
              href={buildHref(params, 'category', String(c.id))}
              active={params.category === String(c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {/* Task table */}
      <div className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
        {tasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-ouc-text-muted">
            No tasks match the current filters.{' '}
            <Link href="/tasks" className="text-ouc-accent hover:underline">
              Clear filters
            </Link>
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
              {tasks.map((t) => {
                const category = t.category_id ? catName.get(t.category_id) ?? '—' : '—';
                const location = t.location_id ? locName.get(t.location_id) ?? '—' : '—';
                const href = t.legacy_id != null ? `/tasks/${t.legacy_id}` : '#';
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
                      <Link href={href} className="block">
                        <div className="font-semibold text-ouc-text hover:text-ouc-accent">
                          {t.title}
                        </div>
                        <div className="text-[11.5px] text-ouc-text-muted">
                          {t.subtask_count} sub-task
                          {t.subtask_count === 1 ? '' : 's'}
                          {t.subtask_done_count > 0 &&
                            ` · ${t.subtask_done_count} done`}{' '}
                          · #{t.legacy_id ?? '—'}
                        </div>
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
                      <span className={`text-[12.5px] font-medium ${STATUS_COLOR[t.status] ?? ''}`}>
                        <span
                          className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${
                            STATUS_DOT[t.status] ?? 'bg-ouc-text-muted'
                          }`}
                        />
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local components
// ---------------------------------------------------------------------------

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors ${
        active
          ? 'border-ouc-primary bg-ouc-primary text-white'
          : 'border-ouc-border bg-white text-ouc-text hover:bg-ouc-surface-alt'
      }`}
    >
      {children}
    </Link>
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
      className={`px-2.5 py-2.5 align-middle ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </td>
  );
}
