/**
 * /reports/print — Formal Task Report
 *
 * Reproduces the original OUC IT Infrastructure Tasks.docx structure:
 * OUC logo header, all tasks as table rows, sub-tasks nested inside,
 * priority / status / location / cost columns.
 *
 * Opens in a new tab from the Reports page and auto-triggers window.print().
 * Add ?preview=1 to suppress auto-print for layout inspection.
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Task Report — OUC Infrastructure' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Subtask = {
  id: string;
  sequence: number;
  description: string;
  labor_cost: number | null;
  equipment_cost: number | null;
  status: string;
};

type Task = {
  id: string;
  legacy_id: number;
  title: string;
  priority: number;
  status: string;
  category_id: number | null;
  location_id: number | null;
  assignee_id: string | null;
  contractor_id: string | null;
  due_date: string | null;
  notes: string | null;
  total_labor_cost: number;
  total_equipment_cost: number;
  total_cost: number;
  subtasks: Subtask[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_SHORT: Record<string, string> = {
  not_started: 'NS',
  in_progress: 'IP',
  blocked:     'BL',
  done:        'DN',
};

const STATUS_SYMBOL: Record<string, string> = {
  not_started: '○',
  in_progress: '▶',
  blocked:     '✖',
  done:        '✓',
};

function usd(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n));
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US',
    { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Auto-print client component
// ---------------------------------------------------------------------------
import AutoPrintClient from './AutoPrintClient';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const isPreview   = preview === '1';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/reports/print');

  // Fetch everything in parallel
  const [
    { data: tasksData },
    { data: subtasksData },
    { data: cats },
    { data: locs },
    { data: users },
    { data: contractors },
  ] = await Promise.all([
    supabase
      .from('task_with_totals')
      .select('id, legacy_id, title, priority, status, category_id, location_id, assignee_id, contractor_id, due_date, notes, total_labor_cost, total_equipment_cost, total_cost')
      .order('legacy_id'),
    supabase
      .from('subtask')
      .select('id, task_id, sequence, description, labor_cost, equipment_cost, status')
      .order('sequence'),
    supabase.from('category').select('id, name'),
    supabase.from('location').select('id, name'),
    supabase.from('user_profile').select('id, full_name'),
    supabase.from('contractor').select('id, business_name'),
  ]);

  const catMap  = new Map((cats  ?? []).map((c) => [c.id, c.name]));
  const locMap  = new Map((locs  ?? []).map((l) => [l.id, l.name]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const conMap  = new Map((contractors ?? []).map((c) => [c.id, c.business_name]));

  // Group subtasks by task_id
  const subMap = new Map<string, Subtask[]>();
  for (const s of (subtasksData ?? [])) {
    const arr = subMap.get(s.task_id) ?? [];
    arr.push(s as Subtask);
    subMap.set(s.task_id, arr);
  }

  const tasks: Task[] = (tasksData ?? []).map((t) => ({
    ...t,
    total_labor_cost:     Number(t.total_labor_cost),
    total_equipment_cost: Number(t.total_equipment_cost),
    total_cost:           Number(t.total_cost),
    subtasks:             subMap.get(t.id) ?? [],
  }));

  const grandTotal = tasks.reduce((s, t) => s + t.total_cost, 0);
  const today      = new Date().toLocaleDateString('en-US',
    { month: 'long', day: 'numeric', year: 'numeric' });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Auto-print (suppressed in preview mode) */}
      <AutoPrintClient preview={isPreview} />

      {/* Global print styles — sets landscape, hides browser chrome */}
      <style>{`
        @page { size: letter landscape; margin: 1.5cm 1.2cm; }
        @media print {
          aside, nav, header, .no-print { display: none !important; }
          body { font-family: 'Times New Roman', Times, serif; }
          .page-break-avoid { page-break-inside: avoid; }
        }
        body { font-family: 'Times New Roman', Times, serif; background: white; }
      `}</style>

      <div className="mx-auto max-w-[1200px] bg-white px-6 py-8 text-[12px] text-gray-900">

        {/* ── Report Header ── */}
        <div className="mb-6 flex items-start justify-between border-b-2 border-gray-800 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/ouc-full-pms432.png"
            alt="Oakwood University Church"
            className="h-14 w-auto"
          />
          <div className="text-right">
            <div className="text-[18px] font-bold text-gray-900">
              OUC IT Infrastructure Task Report
            </div>
            <div className="mt-0.5 text-[12px] text-gray-600">
              Generated {today} · {tasks.length} tasks · Grand Total: {usd(grandTotal)}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-400">
              Confidential — for internal use only · tasks.oucsda.org
            </div>
          </div>
        </div>

        {/* ── Task Table ── */}
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b-2 border-gray-800 bg-gray-100">
              <Th w="4%">#</Th>
              <Th w="35%" align="left">Task / Sub-tasks</Th>
              <Th w="12%" align="left">Location</Th>
              <Th w="10%" align="left">Assignee / Contractor</Th>
              <Th w="6%">Pri</Th>
              <Th w="6%">Status</Th>
              <Th w="9%" align="right">Labor</Th>
              <Th w="9%" align="right">Equip</Th>
              <Th w="9%" align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, idx) => (
              <TaskBlock
                key={task.id}
                task={task}
                idx={idx}
                locMap={locMap}
                userMap={userMap}
                conMap={conMap}
              />
            ))}
          </tbody>

          {/* Grand total footer */}
          <tfoot>
            <tr className="border-t-2 border-gray-800 bg-gray-100 font-bold">
              <td colSpan={6} className="px-2 py-2 text-right text-[11.5px] uppercase tracking-wider">
                Grand Total Backlog
              </td>
              <Td align="right">{usd(tasks.reduce((s, t) => s + t.total_labor_cost, 0))}</Td>
              <Td align="right">{usd(tasks.reduce((s, t) => s + t.total_equipment_cost, 0))}</Td>
              <Td align="right" className="font-bold">{usd(grandTotal)}</Td>
            </tr>
          </tfoot>
        </table>

        {/* ── Legend ── */}
        <div className="no-print mt-6 flex flex-wrap gap-6 border-t border-gray-300 pt-4 text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700">Status codes:</span>
          <span>NS = Not Started</span>
          <span>IP = In Progress</span>
          <span>BL = Blocked</span>
          <span>DN = Done</span>
          <span className="ml-4 font-semibold text-gray-700">Symbols:</span>
          <span>○ Not Started</span>
          <span>▶ In Progress</span>
          <span>✖ Blocked</span>
          <span>✓ Done</span>
        </div>

        {/* Print-only footer */}
        <div className="mt-6 hidden border-t border-gray-300 pt-3 text-center text-[10px] text-gray-400 print:block">
          Oakwood University Church — tasks.oucsda.org — Confidential
        </div>

        {/* Screen-only controls */}
        <div className="no-print mt-8 flex items-center gap-4 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-gray-700"
          >
            🖨 Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
          <span className="text-[12px] text-gray-400">
            Tip: add <code>?preview=1</code> to the URL to suppress auto-print
          </span>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Task row block (task + nested subtasks)
// ---------------------------------------------------------------------------
function TaskBlock({
  task, idx, locMap, userMap, conMap,
}: {
  task: Task;
  idx: number;
  locMap: Map<number, string>;
  userMap: Map<string, string>;
  conMap: Map<string, string>;
}) {
  const isEven    = idx % 2 === 0;
  const rowBg     = isEven ? 'bg-white' : 'bg-gray-50';
  const assignee  = task.assignee_id  ? userMap.get(task.assignee_id)  : null;
  const contractor = task.contractor_id ? conMap.get(task.contractor_id) : null;
  const personnel = contractor ?? assignee ?? '—';

  return (
    <tr className={`page-break-avoid border-b border-gray-200 ${rowBg} align-top`}>
      {/* Task # */}
      <td className="px-2 py-1.5 text-center font-bold text-gray-700">
        {task.legacy_id}
      </td>

      {/* Task title + subtasks */}
      <td className="px-2 py-1.5">
        <div className="font-bold text-gray-900">{task.title}</div>
        {task.notes && (
          <div className="mt-0.5 text-[10.5px] italic text-gray-500">{task.notes}</div>
        )}
        {task.due_date && (
          <div className="mt-0.5 text-[10.5px] text-gray-500">
            Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US',
              { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
        {/* Subtasks */}
        {task.subtasks.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-gray-300 pl-2.5">
            {task.subtasks.map((s) => (
              <div key={s.id} className="flex items-start gap-1.5">
                <span className={`mt-0.5 shrink-0 text-[11px] ${
                  s.status === 'done'        ? 'text-green-700'  :
                  s.status === 'in_progress' ? 'text-blue-700'   :
                  s.status === 'blocked'     ? 'text-red-700'    : 'text-gray-400'
                }`}>
                  {STATUS_SYMBOL[s.status] ?? '○'}
                </span>
                <span className={`text-[10.5px] leading-tight ${
                  s.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'
                }`}>
                  {s.sequence}. {s.description}
                </span>
                {(s.labor_cost || s.equipment_cost) && (
                  <span className="ml-auto shrink-0 text-[10px] tabular-nums text-gray-400">
                    {usd((Number(s.labor_cost ?? 0) + Number(s.equipment_cost ?? 0)))}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>

      {/* Location */}
      <td className="px-2 py-1.5 text-gray-600">
        {task.location_id ? locMap.get(task.location_id) ?? '—' : '—'}
      </td>

      {/* Assignee / Contractor */}
      <td className="px-2 py-1.5 text-gray-600">{personnel}</td>

      {/* Priority */}
      <td className="px-2 py-1.5 text-center font-bold">P{task.priority}</td>

      {/* Status */}
      <td className="px-2 py-1.5 text-center font-mono text-[10.5px]">
        {STATUS_SHORT[task.status] ?? task.status}
      </td>

      {/* Costs */}
      <Td align="right">{usd(task.total_labor_cost)}</Td>
      <Td align="right">{usd(task.total_equipment_cost)}</Td>
      <Td align="right" className="font-semibold">{usd(task.total_cost)}</Td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------
function Th({ children, w, align = 'center' }: {
  children: React.ReactNode; w?: string; align?: 'left' | 'center' | 'right';
}) {
  return (
    <th
      style={{ width: w }}
      className={`px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700 text-${align}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left', className = '' }: {
  children: React.ReactNode; align?: 'left' | 'center' | 'right'; className?: string;
}) {
  return (
    <td className={`px-2 py-1.5 tabular-nums text-${align} ${className}`}>
      {children}
    </td>
  );
}
