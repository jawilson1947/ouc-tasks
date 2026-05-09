'use client';

/**
 * SubtaskEditor — full CRUD panel for the task edit page.
 *
 * Features:
 * - Lists existing subtasks with Edit / Delete per row
 * - Inline edit form expands in-place when Edit is clicked
 * - Add New Subtask form at the bottom
 * - All mutations go through server actions (createSubtask, updateSubtask, deleteSubtask)
 */
import { useState, useRef } from 'react';
import {
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from '@/app/(app)/tasks/subtask-actions';

type Subtask = {
  id: string;
  sequence: number;
  description: string;
  labor_cost: number | string;
  equipment_cost: number | string;
  status: string;
};

const STATUS_BADGE: Record<string, string> = {
  not_started: 'text-ouc-text-muted',
  in_progress: 'text-status-prog font-semibold',
  done:        'text-status-done font-semibold line-through',
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done:        'Done',
};

function fmtUSD(n: number | string) {
  const v = Number(n);
  if (!v) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

// ---------------------------------------------------------------------------
// Individual row — read mode or edit mode
// ---------------------------------------------------------------------------
function SubtaskEditRow({
  s,
  taskId,
  legacyId,
}: {
  s: Subtask;
  taskId: string;
  legacyId: number;
}) {
  const [editing, setEditing] = useState(false);
  const deleteRef = useRef<HTMLFormElement>(null);

  if (editing) {
    return (
      <div className="rounded-md border border-ouc-accent/30 bg-ouc-surface px-3 py-3">
        <form action={updateSubtask} onSubmit={() => setEditing(false)}>
          <input type="hidden" name="subtask_id" value={s.id} />
          <input type="hidden" name="legacy_id"  value={legacyId} />

          <div className="mb-2">
            <label className="mb-0.5 block text-[11.5px] font-semibold text-ouc-text-muted">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              id={`edit-desc-${s.id}`}
              name="description"
              type="text"
              required
              defaultValue={s.description}
              autoFocus
              className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
            />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-0.5 block text-[11.5px] font-semibold text-ouc-text-muted">
                Labor Cost ($)
              </label>
              <input
                id={`edit-labor-${s.id}`}
                name="labor_cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(s.labor_cost) || ''}
                placeholder="0.00"
                className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11.5px] font-semibold text-ouc-text-muted">
                Equipment Cost ($)
              </label>
              <input
                id={`edit-equip-${s.id}`}
                name="equipment_cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(s.equipment_cost) || ''}
                placeholder="0.00"
                className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              id={`save-subtask-${s.id}`}
              className="cursor-pointer rounded-md bg-ouc-primary px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ouc-primary-hover"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded-md border border-ouc-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Read mode
  const total = Number(s.labor_cost) + Number(s.equipment_cost);
  return (
    <div className="grid grid-cols-[20px_1fr_auto_auto_auto] items-center gap-3 rounded-md px-2 py-2.5 hover:bg-ouc-surface">
      {/* Sequence */}
      <span className="text-center text-[11.5px] font-bold text-ouc-text-muted">
        {s.sequence}
      </span>

      {/* Description + status */}
      <div>
        <div className={`text-[13.5px] ${STATUS_BADGE[s.status] ?? ''}`}>
          {s.description}
        </div>
        <div className="text-[11px] text-ouc-text-muted">
          {STATUS_LABEL[s.status] ?? s.status}
        </div>
      </div>

      {/* Cost */}
      <span className="text-right text-[13px] font-semibold tabular-nums text-ouc-text">
        {total > 0 ? fmtUSD(total) : <span className="text-ouc-text-muted">—</span>}
      </span>

      {/* Edit */}
      <button
        type="button"
        id={`edit-subtask-btn-${s.id}`}
        onClick={() => setEditing(true)}
        className="cursor-pointer rounded border border-ouc-border bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ouc-text hover:bg-ouc-surface-alt"
      >
        Edit
      </button>

      {/* Delete */}
      <form
        ref={deleteRef}
        action={deleteSubtask}
      >
        <input type="hidden" name="subtask_id" value={s.id} />
        <input type="hidden" name="legacy_id"  value={legacyId} />
        <button
          type="button"
          id={`delete-subtask-btn-${s.id}`}
          onClick={() => {
            if (confirm(`Delete sub-task ${s.sequence}: "${s.description}"?`)) {
              deleteRef.current?.requestSubmit();
            }
          }}
          className="cursor-pointer rounded border border-red-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-new form
// ---------------------------------------------------------------------------
function AddSubtaskForm({ taskId, legacyId }: { taskId: string; legacyId: number }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        id="add-subtask-btn"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-ouc-border px-3 py-2 text-[13px] text-ouc-text-muted hover:border-ouc-accent hover:text-ouc-accent"
      >
        <span className="text-base leading-none">+</span> Add sub-task
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-md border border-ouc-accent/30 bg-ouc-surface px-3 py-3">
      <form action={createSubtask} onSubmit={() => setOpen(false)}>
        <input type="hidden" name="task_id"   value={taskId} />
        <input type="hidden" name="legacy_id" value={legacyId} />

        <div className="mb-2">
          <label className="mb-0.5 block text-[11.5px] font-semibold text-ouc-text-muted">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            id="new-subtask-description"
            name="description"
            type="text"
            required
            autoFocus
            placeholder="What needs to be done?"
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-0.5 block text-[11.5px] font-semibold text-ouc-text-muted">
              Labor Cost ($)
            </label>
            <input
              id="new-subtask-labor"
              name="labor_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11.5px] font-semibold text-ouc-text-muted">
              Equipment Cost ($)
            </label>
            <input
              id="new-subtask-equipment"
              name="equipment_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            id="save-new-subtask-btn"
            className="cursor-pointer rounded-md bg-ouc-primary px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            Add Sub-task
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
// Main export
// ---------------------------------------------------------------------------
export function SubtaskEditor({
  subtasks,
  taskId,
  legacyId,
}: {
  subtasks: Subtask[];
  taskId: string;
  legacyId: number;
}) {
  const totalCost = subtasks.reduce(
    (sum, s) => sum + Number(s.labor_cost) + Number(s.equipment_cost),
    0,
  );

  return (
    <section className="mt-6 rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ouc-primary">
          Sub-tasks
          {subtasks.length > 0 && (
            <span className="ml-2 rounded-full bg-ouc-surface px-2 py-0.5 text-[10px] font-bold text-ouc-text-muted normal-case tracking-normal">
              {subtasks.length}
            </span>
          )}
        </h2>
        {subtasks.length > 0 && (
          <span className="text-[12px] font-semibold tabular-nums text-ouc-text-muted">
            Total: {fmtUSD(totalCost)}
          </span>
        )}
      </div>

      {/* Column headers (only when rows exist) */}
      {subtasks.length > 0 && (
        <div className="mb-1 grid grid-cols-[20px_1fr_auto_auto_auto] gap-3 border-b border-ouc-border pb-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted">#</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted">Description</div>
          <div className="text-right text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted">Cost</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted" />
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted" />
        </div>
      )}

      {/* Rows */}
      {subtasks.length === 0 && (
        <p className="mb-2 text-[13px] text-ouc-text-muted">
          No sub-tasks yet. Add the first one below.
        </p>
      )}
      <div className="flex flex-col divide-y divide-ouc-border">
        {subtasks.map((s) => (
          <SubtaskEditRow key={s.id} s={s} taskId={taskId} legacyId={legacyId} />
        ))}
      </div>

      {/* Add new */}
      <AddSubtaskForm taskId={taskId} legacyId={legacyId} />
    </section>
  );
}
