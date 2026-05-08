/**
 * TaskForm — server-renderable form for creating / editing a task.
 *
 * Renders dropdowns for Category, Location, Contractor (NEW), Assignee,
 * plus Priority, Status, Due Date, and free-text Title / Description / Notes.
 */
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

type Cat = { id: number; name: string };
type Loc = { id: number; name: string };
type Contractor = { id: string; business_name: string; active: boolean };
type Person = { id: string; full_name: string; role: string; active: boolean };

const STATUSES: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'done',        label: 'Done' },
];

const PRIORITIES = [
  { value: 5, label: 'P5 — Highest' },
  { value: 4, label: 'P4 — High' },
  { value: 3, label: 'P3 — Medium' },
  { value: 2, label: 'P2 — Low' },
  { value: 1, label: 'P1 — Lowest' },
];

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
  // Show only active contractors in the dropdown — but keep an inactive
  // contractor visible if it's the currently-linked one (so the row doesn't
  // appear blank during editing).
  const activeContractors = contractors.filter((c) => c.active);
  const currentContractor = defaults.contractor_id
    ? contractors.find((c) => c.id === defaults.contractor_id)
    : null;
  const contractorOptions = currentContractor && !currentContractor.active
    ? [...activeContractors, currentContractor]
    : activeContractors;

  const activeAssignees = users.filter((u) => u.active);

  return (
    <form
      action={action}
      className="rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm"
    >
      {isEdit && defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {isEdit && defaults.legacy_id != null && (
        <input type="hidden" name="legacy_id" value={defaults.legacy_id} />
      )}

      <Section title="Task">
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
            rows={3}
            defaultValue={defaults.description ?? ''}
            placeholder="Background, scope, special instructions…"
            className={`${INPUT} resize-y`}
          />
        </Field>
      </Section>

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
            <span className="mt-1 text-[11.5px] text-ouc-text-muted">
              No contractors on file yet.{' '}
              <Link href="/contractors/new" className="text-ouc-accent hover:underline">
                Add one
              </Link>{' '}
              if this task needs to be linked to a vendor.
            </span>
          )}
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" colSpan={3}>
          <textarea
            name="notes"
            rows={2}
            defaultValue={defaults.notes ?? ''}
            placeholder="Anything that doesn't belong in the public description."
            className={`${INPUT} resize-y`}
          />
        </Field>
      </Section>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-ouc-border pt-4">
        <Link
          href={cancelHref}
          className="rounded-md border border-ouc-border bg-white px-4 py-2 text-[13px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const INPUT =
  'w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{children}</div>
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
  const span =
    colSpan === 3 ? 'md:col-span-3' : colSpan === 2 ? 'md:col-span-2' : '';
  return (
    <label className={`flex flex-col gap-1 ${span}`}>
      <span className="text-[12px] font-semibold text-ouc-text">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
