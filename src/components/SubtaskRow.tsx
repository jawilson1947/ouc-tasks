'use client';

/**
 * SubtaskRow — interactive subtask row for the task detail page.
 *
 * - Clicking the checkbox cycles: not_started → in_progress → done → not_started
 * - The status badge is a native <select> that submits immediately on change
 *   (for precise control without cycling)
 * - Both controls submit a hidden form via the updateSubtaskStatus server action
 */
import { useRef } from 'react';
import { updateSubtaskStatus } from '@/app/(app)/tasks/subtask-actions';

type SubtaskStatus = 'not_started' | 'in_progress' | 'done';

const STATUS_CYCLE: SubtaskStatus[] = ['not_started', 'in_progress', 'done'];

const STATUS_LABEL: Record<SubtaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done:        'Done',
};

const STATUS_SELECT_CLASS: Record<SubtaskStatus, string> = {
  not_started: 'border-ouc-border bg-white text-ouc-text-muted',
  in_progress: 'border-status-prog/40 bg-status-prog/8 text-status-prog',
  done:        'border-status-done/40 bg-status-done/8 text-status-done',
};

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export function SubtaskRow({
  subtask,
  legacyId,
  index,
}: {
  subtask: {
    id: string;
    sequence: number;
    description: string;
    labor_cost: number | string;
    equipment_cost: number | string;
    status: string;
  };
  legacyId: number;
  index: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  const status = subtask.status as SubtaskStatus;
  const cost = Number(subtask.labor_cost) + Number(subtask.equipment_cost);
  const done = status === 'done';

  function cycleStatus() {
    const currentIdx = STATUS_CYCLE.indexOf(status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    if (statusRef.current) {
      statusRef.current.value = nextStatus;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <div
      className={`grid grid-cols-[24px_1fr_auto_140px] items-center gap-3 rounded-md px-2 py-2.5 transition-colors ${
        index > 0 ? 'border-t border-ouc-border' : ''
      } hover:bg-ouc-surface`}
    >
      {/* Hidden form — submitted programmatically by both controls */}
      <form ref={formRef} action={updateSubtaskStatus} className="hidden">
        <input type="hidden" name="subtask_id" value={subtask.id} />
        <input type="hidden" name="legacy_id"  value={legacyId} />
        <select
          ref={statusRef}
          name="status"
          defaultValue={status}
          aria-hidden
          tabIndex={-1}
        >
          {STATUS_CYCLE.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </form>

      {/* Checkbox — cycles through statuses */}
      <button
        type="button"
        id={`subtask-checkbox-${subtask.id}`}
        onClick={cycleStatus}
        aria-label={`Cycle status for sub-task ${subtask.sequence} (currently ${STATUS_LABEL[status]})`}
        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ouc-accent/30"
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
          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 9" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 4.5L4.5 8 11 1" />
          </svg>
        )}
        {status === 'in_progress' && (
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
        )}
      </button>

      {/* Description */}
      <div
        className={`text-[13.5px] leading-snug ${
          done ? 'text-ouc-text-muted line-through' : 'text-ouc-text'
        }`}
      >
        <span className="mr-1.5 text-[11px] font-semibold tabular-nums text-ouc-text-muted">
          {subtask.sequence}.
        </span>
        {subtask.description}
      </div>

      {/* Cost */}
      <div className="text-right text-[13px] font-semibold tabular-nums">
        {cost > 0 ? fmtUSD(cost) : <span className="text-ouc-text-muted">—</span>}
      </div>

      {/* Status select — visible dropdown for direct selection */}
      <form action={updateSubtaskStatus}>
        <input type="hidden" name="subtask_id" value={subtask.id} />
        <input type="hidden" name="legacy_id"  value={legacyId} />
        <select
          name="status"
          defaultValue={status}
          onChange={(e) => (e.target.form as HTMLFormElement).requestSubmit()}
          id={`subtask-status-${subtask.id}`}
          className={`w-full cursor-pointer rounded-md border px-2 py-1 text-[11.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-ouc-accent/20 ${
            STATUS_SELECT_CLASS[status] ?? STATUS_SELECT_CLASS.not_started
          }`}
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </form>
    </div>
  );
}
