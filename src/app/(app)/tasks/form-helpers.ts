/**
 * Shared form parsing + validation for task create/update server actions.
 *
 * Extracted from src/app/(app)/tasks/actions.ts so it can also be reused by
 * src/app/(app)/approvals/actions.ts (approver-initiated edits).
 */

export type TaskFormFields = {
  title: string | null;
  description: string | null;
  priority: number | null;
  status: string | null;
  category_id: number | null;
  location_id: number | null;
  contractor_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  notes: string | null;
};

export const VALID_STATUSES = new Set([
  'not_started',
  'in_progress',
  'blocked',
  'done',
  'closed',
]);

export function readForm(formData: FormData): TaskFormFields {
  const get = (k: string): string | null => {
    const v = formData.get(k);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };
  const intOrNull = (k: string): number | null => {
    const s = get(k);
    if (s == null) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  return {
    title:        get('title'),
    description:  get('description'),
    priority:     intOrNull('priority'),
    status:       get('status'),
    category_id:  intOrNull('category_id'),
    location_id:  intOrNull('location_id'),
    contractor_id: get('contractor_id'),
    assignee_id:  get('assignee_id'),
    due_date:     get('due_date'),
    notes:        get('notes'),
  };
}

/** Returns a user-facing error message or null when valid. */
export function validate(fields: TaskFormFields): string | null {
  if (!fields.title) return 'Title is required.';
  if (fields.priority == null || fields.priority < 1 || fields.priority > 5) {
    return 'Priority must be 1–5.';
  }
  if (!fields.status || !VALID_STATUSES.has(fields.status)) {
    return 'Pick a valid status.';
  }
  if (fields.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.due_date)) {
    return 'Due date must be YYYY-MM-DD.';
  }
  return null;
}
