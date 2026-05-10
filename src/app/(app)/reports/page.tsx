/**
 * Reports — Server Component, summary tables with CSS-only horizontal bars.
 *
 * V1 scope: Cost by Category, Cost by Priority, Cost by Location, Status
 * Distribution. Charts (Chart.js) and PDF export are TODOs.
 */
import { createClient } from '@/lib/supabase/server';
import { fmtUSD } from '@/lib/format';
import { STATUS_LABEL, STATUS_ORDER, STATUS_DOT } from '@/lib/task-display';
import { ReportsExportBar } from '@/components/ReportsExportBar';

export const metadata = { title: 'Reports — OUC Infrastructure Tasks' };

type ReportTask = {
  priority: number;
  status: string;
  category_id: number | null;
  location_id: number | null;
  total_cost: number;
};

const PRIORITY_COLOR: Record<number, string> = {
  5: 'bg-[#1F2830]',
  4: 'bg-[#424E58]',
  3: 'bg-[#6B7480]',
  2: 'bg-[#9BA1A8]',
  1: 'bg-[#C5C9CE]',
};

function categoryBarColor(name: string | undefined): string {
  if (!name) return 'bg-ouc-text-muted';
  if (name.startsWith('Surveillance'))     return 'bg-cat-surveillance';
  if (name.startsWith('Access'))           return 'bg-cat-access';
  if (name.startsWith('AV'))               return 'bg-cat-av';
  if (name.startsWith('Cabling'))          return 'bg-cat-cabling';
  if (name.startsWith('Maintenance'))      return 'bg-cat-maintenance';
  return 'bg-ouc-text-muted';
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [
    { data: tasksData, error: tasksErr },
    { data: cats },
    { data: locs },
  ] = await Promise.all([
    supabase
      .from('task_with_totals')
      .select('priority, status, category_id, location_id, total_cost'),
    supabase.from('category').select('id, name').order('sort_order'),
    supabase.from('location').select('id, name'),
  ]);

  if (tasksErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load reports:</strong> {tasksErr.message}
      </div>
    );
  }

  const tasks = (tasksData ?? []) as ReportTask[];
  const categories = cats ?? [];
  const locations = locs ?? [];
  const catName = new Map<number, string>(categories.map((c) => [c.id, c.name]));
  const locName = new Map<number, string>(locations.map((l) => [l.id, l.name]));

  const grandTotal = tasks.reduce((sum, t) => sum + Number(t.total_cost), 0);

  // Aggregate helpers
  function aggBy<K>(keyFn: (t: ReportTask) => K) {
    const map = new Map<K, { count: number; cost: number }>();
    for (const t of tasks) {
      const k = keyFn(t);
      const cur = map.get(k) ?? { count: 0, cost: 0 };
      cur.count += 1;
      cur.cost += Number(t.total_cost);
      map.set(k, cur);
    }
    return map;
  }

  const byCategory = aggBy((t) => t.category_id ?? 0);
  const byPriority = aggBy((t) => t.priority);
  const byLocation = aggBy((t) => t.location_id ?? 0);
  const byStatus = aggBy((t) => t.status);

  type Row = { label: string; count: number; cost: number; barClass: string };

  const categoryRows: Row[] = categories
    .map((c) => {
      const a = byCategory.get(c.id);
      return {
        label: c.name,
        count: a?.count ?? 0,
        cost: a?.cost ?? 0,
        barClass: categoryBarColor(c.name),
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.cost - a.cost);

  const priorityRows: Row[] = [5, 4, 3, 2, 1].map((p) => {
    const a = byPriority.get(p);
    return {
      label: `P${p}`,
      count: a?.count ?? 0,
      cost: a?.cost ?? 0,
      barClass: PRIORITY_COLOR[p] ?? 'bg-ouc-primary',
    };
  });

  const locationRows: Row[] = locations
    .map((l) => {
      const a = byLocation.get(l.id);
      return { label: l.name, count: a?.count ?? 0, cost: a?.cost ?? 0, barClass: 'bg-ouc-primary' };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.cost - a.cost);

  const statusRows: Row[] = STATUS_ORDER.map((s) => {
    const a = byStatus.get(s);
    return {
      label: STATUS_LABEL[s] ?? s,
      count: a?.count ?? 0,
      cost: a?.cost ?? 0,
      barClass: (STATUS_DOT[s] ?? 'bg-ouc-primary'),
    };
  });

  return (
    <div>
      {/* Print-only CSS */}
      <style>{`
        @media print {
          /* Hide nav chrome */
          aside, nav, header, .no-print { display: none !important; }

          /* Print header — hidden on screen */
          .print-header { display: flex !important; }

          /* Landscape */
          html[data-print-orientation="landscape"] { }
          html[data-print-orientation="landscape"] .report-grid {
            grid-template-columns: 1fr 1fr;
          }
          @page { margin: 1.5cm; }
          html[data-print-orientation="landscape"] + * { }
          html[data-print-orientation="landscape"] { }

          /* Apply orientation via @page */
          html[data-print-orientation="portrait"]  { }
          html[data-print-orientation="portrait"]  .report-grid { grid-template-columns: 1fr; }

          /* Force the @page size based on data attribute —
             browsers respect the last matching @page rule */
          @page { size: landscape; margin: 1.5cm; }
        }

        /* Override to portrait when that option is chosen */
        @media print {
          html[data-print-orientation="portrait"] * { }
        }

        /* Screen — hide the print header */
        .print-header { display: none; }
      `}</style>

      {/* Print header — shown only in print output */}
      <div className="print-header mb-6 items-center justify-between border-b border-gray-300 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/ouc-full-pms432.png" alt="OUC" className="h-10 w-auto" />
        <div className="text-right">
          <div className="text-[15px] font-bold text-ouc-primary">Infrastructure Tasks — Reports</div>
          <div className="text-[11px] text-ouc-text-muted">
            Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">Reports</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold">{fmtUSD(grandTotal)}</span> total backlog
          </div>
        </div>
        <ReportsExportBar />
      </div>

      <div className="report-grid grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ReportCard title="Cost by Category" rows={categoryRows} grandTotal={grandTotal} />
        <ReportCard title="Cost by Priority" rows={priorityRows} grandTotal={grandTotal} />
        <ReportCard title="Status Distribution" rows={statusRows} grandTotal={grandTotal} />
        <ReportCard
          title="Cost by Location"
          rows={locationRows.slice(0, 12)}
          grandTotal={grandTotal}
          footer={
            locationRows.length > 12
              ? `Showing top 12 of ${locationRows.length} locations.`
              : undefined
          }
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  rows,
  grandTotal,
  footer,
}: {
  title: string;
  rows: { label: string; count: number; cost: number; barClass: string }[];
  grandTotal: number;
  footer?: string;
}) {
  const max = Math.max(...rows.map((r) => r.cost), 0);
  return (
    <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
      <h2 className="mb-3 text-[15px] font-bold text-ouc-primary">{title}</h2>
      {rows.length === 0 ? (
        <div className="py-4 text-center text-sm text-ouc-text-muted">No data.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const pct = max > 0 ? (r.cost / max) * 100 : 0;
            const sharePct = grandTotal > 0 ? (r.cost / grandTotal) * 100 : 0;
            return (
              <div
                key={r.label}
                className="grid grid-cols-[110px_1fr_70px_50px] items-center gap-3 text-[12.5px]"
              >
                <div className="truncate font-medium" title={r.label}>
                  {r.label}
                </div>
                <div className="h-4 overflow-hidden rounded bg-ouc-surface-alt">
                  <div
                    className={`h-full rounded ${r.barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-right tabular-nums text-ouc-text-muted">
                  {fmtUSD(r.cost)}
                </div>
                <div className="text-right text-[11px] tabular-nums text-ouc-text-muted">
                  {sharePct.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
      {footer && (
        <div className="mt-3 border-t border-ouc-border pt-2 text-[11.5px] text-ouc-text-muted">
          {footer}
        </div>
      )}
    </section>
  );
}
