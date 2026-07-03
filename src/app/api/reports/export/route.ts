import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const BOM = '\uFEFF'; // UTF-8 BOM — prevents Excel on Windows mangling accented characters

function esc(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(',');
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  done:        'Done',
  closed:      'Closed',
};
const STATUS_ORDER = ['not_started', 'in_progress', 'blocked', 'done', 'closed'];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const type  = request.nextUrl.searchParams.get('type') ?? 'tasks';
  const today = new Date().toISOString().slice(0, 10);

  // ---------------------------------------------------------------------------
  // CSV Option 1 — Full Task List
  // ---------------------------------------------------------------------------
  if (type === 'tasks') {
    const [tasks, cats, locs, users, contractors] = await Promise.all([
      prisma.taskWithTotals.findMany({
        where: { status: { not: 'closed' } },
        orderBy: { legacyId: 'asc' },
        select: {
          legacyId: true,
          title: true,
          status: true,
          priority: true,
          categoryId: true,
          locationId: true,
          assigneeId: true,
          contractorId: true,
          dueDate: true,
          totalLaborCost: true,
          totalEquipmentCost: true,
          totalCost: true,
          subtaskCount: true,
          subtaskDoneCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.location.findMany({ select: { id: true, name: true } }),
      prisma.userProfile.findMany({ select: { id: true, fullName: true } }),
      prisma.contractor.findMany({ select: { id: true, businessName: true } }),
    ]);

    const catMap  = new Map(cats.map((c) => [c.id, c.name]));
    const locMap  = new Map(locs.map((l) => [l.id, l.name]));
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));
    const conMap  = new Map(contractors.map((c) => [c.id, c.businessName]));

    const lines = [
      `OUC Infrastructure Tasks — Full Task List — ${today}`,
      '',
      csvRow('Task #', 'Title', 'Status', 'Priority', 'Category', 'Location',
             'Assignee', 'Contractor', 'Due Date',
             'Labor Cost', 'Equipment Cost', 'Total Cost',
             'Sub-tasks', 'Done Sub-tasks', 'Created', 'Updated'),
      ...tasks.map((t) =>
        csvRow(
          t.legacyId,
          t.title,
          STATUS_LABEL[t.status] ?? t.status,
          `P${t.priority}`,
          (t.categoryId   != null ? catMap.get(t.categoryId)   : '') ?? '',
          (t.locationId   != null ? locMap.get(t.locationId)   : '') ?? '',
          (t.assigneeId   != null ? userMap.get(t.assigneeId)  : '') ?? '',
          (t.contractorId != null ? conMap.get(t.contractorId) : '') ?? '',
          t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '',
          Number(t.totalLaborCost).toFixed(2),
          Number(t.totalEquipmentCost).toFixed(2),
          Number(t.totalCost).toFixed(2),
          Number(t.subtaskCount),
          Number(t.subtaskDoneCount),
          t.createdAt.toISOString().slice(0, 10),
          t.updatedAt.toISOString().slice(0, 10),
        )
      ),
    ];

    return new NextResponse(BOM + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ouc-tasks-${today}.csv"`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // CSV Option 2 — Report Summary (4 sections)
  // ---------------------------------------------------------------------------
  if (type === 'summary') {
    const [tasks, cats, locs] = await Promise.all([
      prisma.taskWithTotals.findMany({
        where: { status: { not: 'closed' } },
        select: {
          priority: true,
          status: true,
          categoryId: true,
          locationId: true,
          totalCost: true,
        },
      }),
      prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.location.findMany({ select: { id: true, name: true } }),
    ]);

    const list = tasks.map((t) => ({
      priority: t.priority,
      status: t.status as string,
      category_id: t.categoryId,
      location_id: t.locationId,
      total_cost: Number(t.totalCost),
    }));
    const grand = list.reduce((s, t) => s + Number(t.total_cost), 0);

    function agg<K>(keyFn: (t: (typeof list)[0]) => K) {
      const m = new Map<K, { count: number; cost: number }>();
      for (const t of list) {
        const k = keyFn(t);
        const cur = m.get(k) ?? { count: 0, cost: 0 };
        cur.count += 1;
        cur.cost  += Number(t.total_cost);
        m.set(k, cur);
      }
      return m;
    }

    const byCategory = agg((t) => t.category_id ?? 0);
    const byPriority = agg((t) => t.priority);
    const byStatus   = agg((t) => t.status);
    const byLocation = agg((t) => t.location_id ?? 0);
    const pct = (cost: number) =>
      grand > 0 ? ((cost / grand) * 100).toFixed(1) : '0.0';

    const hdr = csvRow('Category', 'Tasks', 'Total Cost', '% of Total');

    const lines = [
      `OUC Infrastructure Tasks — Report Summary — ${today}`,
      '',
      csvRow('Cost by Category'),
      csvRow('Category', 'Tasks', 'Total Cost', '% of Total'),
      ...(cats ?? []).flatMap((c) => {
        const a = byCategory.get(c.id);
        return a ? [csvRow(c.name, a.count, a.cost.toFixed(2), pct(a.cost))] : [];
      }),
      '',
      csvRow('Cost by Priority'),
      csvRow('Priority', 'Tasks', 'Total Cost', '% of Total'),
      ...[5, 4, 3, 2, 1].map((p) => {
        const a = byPriority.get(p);
        return csvRow(`P${p} — ${['Lowest','Low','Medium','High','Highest'][p-1]}`,
          a?.count ?? 0, (a?.cost ?? 0).toFixed(2), pct(a?.cost ?? 0));
      }),
      '',
      csvRow('Status Distribution'),
      csvRow('Status', 'Tasks', 'Total Cost', '% of Total'),
      ...STATUS_ORDER.map((s) => {
        const a = byStatus.get(s);
        return csvRow(STATUS_LABEL[s] ?? s, a?.count ?? 0,
          (a?.cost ?? 0).toFixed(2), pct(a?.cost ?? 0));
      }),
      '',
      csvRow('Cost by Location'),
      csvRow('Location', 'Tasks', 'Total Cost', '% of Total'),
      ...(locs ?? []).flatMap((l) => {
        const a = byLocation.get(l.id);
        return a ? [csvRow(l.name, a.count, a.cost.toFixed(2), pct(a.cost))] : [];
      }),
      '',
      csvRow('Grand Total', list.length, grand.toFixed(2), '100.0'),
    ];

    return new NextResponse(BOM + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ouc-report-summary-${today}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
