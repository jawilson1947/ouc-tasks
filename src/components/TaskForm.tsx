'use client';

/**
 * TaskForm — compact edit/create form for a task.
 *
 * Changes vs. original:
 * - Converted to Client Component to manage the Notes modal state.
 * - Spacing and font sizes reduced ~10% throughout.
 * - "Internal Notes" section removed from the form body and replaced with
 *   an inline link that opens a modal. The value is written back to a hidden
 *   <input name="notes"> so the server action receives it unchanged.
 */
import { useState, useRef } from 'react';
import Link from 'next/link';

export type TaskDefaults = {
  id?: string;
  legacy_id?: number | null;
  title?: string | null;
  description?: string | null;
  priority?: number | null;
  status?: string | null;
  category_id?: number | null;
  location_id?: number | null;
  contractor_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  notes?: string | null;
};

type Cat        = { id: number; name: string };
type Loc        = { id: number; name: string };
type Contractor = { id: string; business_name: string; active: boolean };
type Person     = { id: string; full_name: string; role: string; active: boolean };

const STATUSES: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked'     },
  { value: 'done',        label: 'Done'         },
];

const PRIORITIES = [
  { value: 5, label: 'P5 — Highest' },
  { value: 4, label: 'P4 — High'    },
  { value: 3, label: 'P3 — Medium'  },
  { value: 2, label: 'P2 — Low'     },
  { value: 1, label: 'P1 — Lowest'  },
];

// ---------------------------------------------------------------------------
// Notes modal
// ---------------------------------------------------------------------------
function NotesModal({
  initialValue,
  onSave,
  onClose,
}: {
  initialValue: string;
  onSave: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialValue);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ouc-border px-5 py-3.5">
          <h2 className="text-[14px] font-bold text-ouc-primary">Add Additional Information</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ouc-text-muted hover:bg-ouc-surface hover:text-ouc-text"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="mb-2 text-[11.5px] text-ouc-text-muted">
            Anything that doesn't belong in the public description — vendor contacts, internal
            approvals, budget codes, etc.
          </p>
          <textarea
            id="notes-modal-textarea"
            autoFocus
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add additional information…"
            className="w-full resize-y rounded-lg border border-ouc-border bg-white px-3 py-2 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-ouc-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ouc-border bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
          >
            Cancel
          </button>
          <button
            type="button"
            id="notes-modal-save"
            onClick={() => { onSave(draft); onClose(); }}
            className="rounded-md bg-ouc-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            Save notes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function TaskForm({
  action,
  defaults = {},
  categories,
  locations,
  contractors,
  users,
  submitLabel = 'Create task',
  isEdit = false,
  cancelHref = '/tasks',
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: TaskDefaults;
  categories: Cat[];
  locations: Loc[];
  contractors: Contractor[];
  users: Person[];
  submitLabel?: string;
  isEdit?: boolean;
  cancelHref?: string;
}) {
  const [notesText, setNotesText] = useState(defaults.notes ?? '');
  const [modalOpen, setModalOpen] = useState(false);

  const activeContractors   = contractors.filter((c) => c.active);
  const currentContractor   = defaults.contractor_id
    ? contractors.find((c) => c.id === defaults.contractor_id)
    : null;
  const contractorOptions   = currentContractor && !currentContractor.active
    ? [...activeContractors, currentContractor]
    : activeContractors;

  const activeAssignees = users.filter((u) => u.active);
  const hasNotes        = notesText.trim().length > 0;

  return (
    <>
      <form
        action={action}
        className="rounded-[10px] border border-ouc-border bg-white px-4 py-4 shadow-sm"
      >
        {isEdit && defaults.id && <input type="hidden" name="id" value={defaults.id} />}
        {isEdit && defaults.legacy_id != null && (
          <input type="hidden" name="legacy_id" value={defaults.legacy_id} />
        )}
        {/* Notes value — written by modal, read by server action */}
        <input type="hidden" name="notes" value={notesText} />

        {/* ── Task ── */}
        <fieldset className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <legend className="text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted">
              Task
            </legend>
            <button
              type="button"
              id="open-notes-modal"
              onClick={() => setModalOpen(true)}
              className={`flex cursor-pointer items-center gap-1 text-[11.5px] underline underline-offset-2 transition-colors ${
                hasNotes
                  ? 'text-ouc-accent hover:text-ouc-accent/70'
                  : 'text-ouc-text-muted hover:text-ouc-accent'
              }`}
            >
              {hasNotes && (
                <span className="h-1.5 w-1.5 rounded-full bg-ouc-accent" title="Notes saved" />
              )}
              Add additional information
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <Field label="Title" required colSpan={3}>
              <input
                name="title"
                type="text"
                required
                defaultValue={defaults.title ?? ''}
                placeholder="What needs to be done?"
                className={INPUT}
              />
            </Field>
            <Field label="Description" colSpan={3}>
              <textarea
                name="description"
                rows={2}
                defaultValue={defaults.description ?? ''}
                placeholder="Background, scope, special instructions…"
                className={`${INPUT} resize-y`}
              />
            </Field>
          </div>
        </fieldset>

        {/* ── Classification ── */}
        <Section title="Classification">
          <Field label="Priority" required>
            <select
              name="priority"
              required
              defaultValue={String(defaults.priority ?? 3)}
              className={INPUT}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" required>
            <select
              name="status"
              required
              defaultValue={defaults.status ?? 'not_started'}
              className={INPUT}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input
              name="due_date"
              type="date"
              defaultValue={defaults.due_date ?? ''}
              className={INPUT}
            />
          </Field>
        </Section>

        {/* ── Where & who ── */}
        <Section title="Where & who">
          <Field label="Category">
            <select name="category_id" defaultValue={defaults.category_id ?? ''} className={INPUT}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select name="location_id" defaultValue={defaults.location_id ?? ''} className={INPUT}>
              <option value="">— None —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select name="assignee_id" defaultValue={defaults.assignee_id ?? ''} className={INPUT}>
              <option value="">— Unassigned —</option>
              {activeAssignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} {u.role && `(${u.role})`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contractor" colSpan={3}>
            <select
              name="contractor_id"
              defaultValue={defaults.contractor_id ?? ''}
              className={INPUT}
            >
              <option value="">— No contractor (in-house) —</option>
              {contractorOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}{!c.active && ' (inactive)'}
                </option>
              ))}
            </select>
            {contractors.length === 0 && (
              <span className="mt-1 text-[11px] text-ouc-text-muted">
                No contractors on file yet.{' '}
                <Link href="/contractors/new" className="text-ouc-accent hover:underline">
                  Add one
                </Link>{' '}
                if this task needs to be linked to a vendor.
              </span>
            )}
          </Field>
        </Section>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-ouc-border pt-3">
          <Link
            href={cancelHref}
            className="rounded-md border border-ouc-border bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="cursor-pointer rounded-md bg-ouc-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            {submitLabel}
          </button>
        </div>
      </form>

      {/* Notes modal — rendered outside the form to avoid nesting issues */}
      {modalOpen && (
        <NotesModal
          initialValue={notesText}
          onSave={setNotesText}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared styles & sub-components
// ---------------------------------------------------------------------------
const INPUT =
  'w-full rounded-md border border-ouc-border bg-white px-2 py-1 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-3 last:mb-0">
      <legend className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ouc-text-muted">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  required,
  colSpan = 1,
  children,
}: {
  label: string;
  required?: boolean;
  colSpan?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const span = colSpan === 3 ? 'md:col-span-3' : colSpan === 2 ? 'md:col-span-2' : '';
  return (
    <label className={`flex flex-col gap-1 ${span}`}>
      <span className="text-[11.5px] font-semibold text-ouc-text">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
