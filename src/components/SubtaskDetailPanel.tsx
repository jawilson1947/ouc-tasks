'use client';

/**
 * SubtaskDetailPanel — all-in-one subtask section for the task detail page.
 *
 * Combines:
 * - Status cycling checkbox + dropdown (click to cycle, select for direct pick)
 * - Inline delete with confirm
 * - Inline "Add sub-task" quick form at the bottom
 *
 * All mutations go through server actions; the panel is purely additive over
 * the read-only subtask list that existed before.
 */
import { useRef, useState } from 'react';
import {
  updateSubtaskStatus,
  createSubtask,
  deleteSubtask,
} from '@/app/(app)/tasks/subtask-actions';

type SubtaskStatus = 'not_started' | 'in_progress' | 'done';
type Subtask = {
  id: string;
  sequence: number;
  description: string;
  labor_cost: number | string;
  equipment_cost: number | string;
  status: string;
};

const STATUS_CYCLE: SubtaskStatus[] = ['not_started', 'in_progress', 'done'];

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done:        'Done',
};

const STATUS_SELECT_CLASS: Record<string, string> = {
  not_started: 'border-ouc-border bg-white text-ouc-text-muted',
  in_progress: 'border-status-prog/40 bg-status-prog/8 text-status-prog',
  done:        'border-status-done/40 bg-status-done/8 text-status-done',
};

function fmtUSD(n: number | string) {
  const v = Number(n);
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

// ---------------------------------------------------------------------------
// Single row: status checkbox + status dropdown + delete
// ---------------------------------------------------------------------------
function Row({
  s,
  taskId,
  legacyId,
  isLast,
}: {
  s: Subtask;
  taskId: string;
  legacyId: number;
  isLast: boolean;
}) {
  const statusFormRef = useRef<HTMLFormElement>(null);
  const statusSelectRef = useRef<HTMLSelectElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const status = s.status as SubtaskStatus;
  const done = status === 'done';
  const cost = Number(s.labor_cost) + Number(s.equipment_cost);

  function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    if (statusSelectRef.current) statusSelectRef.current.value = next;
    statusFormRef.current?.requestSubmit();
  }

  return (
    <div
      className={`grid grid-cols-[22px_1fr_90px_130px_32px] items-center gap-2 px-1 py-2.5 ${
        !isLast ? 'border-b border-ouc-border' : ''
      } hover:bg-ouc-surface`}
    >
      {/* ----- Hidden status form (submitted by checkbox click) ----- */}
      <form ref={statusFormRef} action={updateSubtaskStatus} className="hidden">
        <input type="hidden" name="subtask_id" value={s.id} />
        <input type="hidden" name="legacy_id"  value={legacyId} />
        <select ref={statusSelectRef} name="status" defaultValue={status} aria-hidden tabIndex={-1}>
          {STATUS_CYCLE.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
      </form>

      {/* ----- Checkbox (cycles status) ----- */}
      <button
        type="button"
        id={`subtask-cb-${s.id}`}
        onClick={cycleStatus}
        aria-label={`Cycle status (currently ${STATUS_LABEL[status]})`}
        className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ouc-accent/30"
        style={{
          borderColor: done ? 'var(--color-status-done)'
                     : status === 'in_progress' ? 'var(--color-status-prog)'
                     : 'var(--color-ouc-border)',
          backgroundColor: done ? 'var(--color-status-done)'
                         : status === 'in_progress' ? 'var(--color-status-prog)'
                         : 'white',
        }}
      >
        {done && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 9" fill="none" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 4.5L4.5 8 11 1" />
          </svg>
        )}
        {status === 'in_progress' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </button>

      {/* ----- Description ----- */}
      <div className={`text-[13px] leading-snug ${done ? 'text-ouc-text-muted line-through' : 'text-ouc-text'}`}>
        <span className="mr-1 text-[10.5px] tabular-nums text-ouc-text-muted">{s.sequence}.</span>
        {s.description}
      </div>

      {/* ----- Cost ----- */}
      <div className="text-right text-[12.5px] font-semibold tabular-nums">
        {cost > 0 ? fmtUSD(cost) : <span className="text-ouc-text-muted">—</span>}
      </div>

      {/* ----- Status dropdown (direct pick, submits its own form) ----- */}
      <form action={updateSubtaskStatus}>
        <input type="hidden" name="subtask_id" value={s.id} />
        <input type="hidden" name="legacy_id"  value={legacyId} />
        <select
          name="status"
          id={`subtask-status-${s.id}`}
          defaultValue={status}
          onChange={(e) => (e.target.form as HTMLFormElement).requestSubmit()}
          className={`w-full cursor-pointer rounded border px-1.5 py-1 text-[11px] font-semibold focus:outline-none ${
            STATUS_SELECT_CLASS[status] ?? STATUS_SELECT_CLASS.not_started
          }`}
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </form>

      {/* ----- Delete button ----- */}
      <form ref={deleteFormRef} action={deleteSubtask}>
        <input type="hidden" name="subtask_id" value={s.id} />
        <input type="hidden" name="legacy_id"  value={legacyId} />
        <button
          type="button"
          id={`subtask-delete-${s.id}`}
          title="Delete sub-task"
          onClick={() => {
            if (confirm(`Delete sub-task ${s.sequence}: "${s.description}"?`)) {
              deleteFormRef.current?.requestSubmit();
            }
          }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-ouc-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66H14.5a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Z"/>
          </svg>
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick-add form
// ---------------------------------------------------------------------------
function AddRow({ taskId, legacyId }: { taskId: string; legacyId: number }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        id="add-subtask-quick-btn"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-ouc-border px-3 py-2 text-[12.5px] text-ouc-text-muted transition-colors hover:border-ouc-accent hover:text-ouc-accent"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
        </svg>
        Add sub-task
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-ouc-accent/30 bg-ouc-surface px-3 py-3">
      <form action={createSubtask} onSubmit={() => setOpen(false)}>
        <input type="hidden" name="task_id"   value={taskId} />
        <input type="hidden" name="legacy_id" value={legacyId} />

        <div className="mb-2">
          <input
            id="quick-add-description"
            name="description"
            type="text"
            required
            autoFocus
            placeholder="Sub-task description…"
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-semibold text-ouc-text-muted">
              Labor ($)
            </label>
            <input
              id="quick-add-labor"
              name="labor_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[12.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] font-semibold text-ouc-text-muted">
              Equipment ($)
            </label>
            <input
              id="quick-add-equipment"
              name="equipment_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[12.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            id="quick-add-submit"
            className="cursor-pointer rounded-md bg-ouc-primary px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-md border border-ouc-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported panel — replaces the static subtask list on the task detail page
// ---------------------------------------------------------------------------
export function SubtaskDetailPanel({
  subtasks,
  taskId,
  legacyId,
  totalCost,
}: {
  subtasks: Subtask[];
  taskId: string;
  legacyId: number;
  totalCost: number;
}) {
  const doneCount = subtasks.filter((s) => s.status === 'done').length;

  if (subtasks.length === 0) {
    return (
      <>
        <p className="text-sm text-ouc-text-muted">No sub-tasks yet.</p>
        <AddRow taskId={taskId} legacyId={legacyId} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {subtasks.map((s, i) => (
          <Row
            key={s.id}
            s={s}
            taskId={taskId}
            legacyId={legacyId}
            isLast={i === subtasks.length - 1}
          />
        ))}
      </div>

      {/* Footer totals */}
      <div className="mt-2 grid grid-cols-[22px_1fr_90px_130px_32px] gap-2 border-t-2 border-ouc-border px-1 pt-2.5 text-[12px] text-ouc-text-muted">
        <div />
        <div>
          {subtasks.length} sub-task{subtasks.length === 1 ? '' : 's'}
          {doneCount > 0 && ` · ${doneCount} done`}
        </div>
        <div className="text-right text-[13px] font-bold tabular-nums text-ouc-primary">
          {fmtUSD(totalCost)}
        </div>
        <div />
        <div />
      </div>

      {/* Add row */}
      <AddRow taskId={taskId} legacyId={legacyId} />
    </>
  );
}
