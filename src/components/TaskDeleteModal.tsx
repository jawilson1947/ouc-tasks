'use client';

/**
 * TaskDeleteModal — reusable "Delete task" trigger with a styled confirmation
 * modal. Replaces both the bare delete form on /tasks/[id]/edit (which had
 * no confirmation at all) and the native confirm() dialog on /approvals/[id].
 *
 * The trigger is a button rendered inline; clicking it opens an overlay
 * modal with a title, body copy, Cancel button, and a red Delete button that
 * submits a real <form action={...}> to the supplied Server Action. Using a
 * real form (rather than calling the action via fetch) preserves the
 * server-side redirect that the delete action issues — Next.js navigates
 * naturally on success.
 *
 * The pattern mirrors the existing delete-user dialog in
 * src/app/(app)/admin/users/UserTableClient.tsx.
 */
import { useState } from 'react';

export function TaskDeleteModal({
  taskId,
  taskTitle,
  action,
  triggerLabel = 'Delete task',
  triggerClassName = 'cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50',
  notice = 'All sub-tasks, photos, and receipts will also be removed.',
}: {
  /** Task UUID — submitted as the hidden "id" form field. */
  taskId: string;
  /** Title rendered in the modal so the user can confirm they picked the right task. */
  taskTitle: string;
  /** Server Action to call on confirmation. Must accept a FormData with "id". */
  action: (formData: FormData) => void | Promise<void>;
  /** Text shown on the trigger button. Defaults to "Delete task". */
  triggerLabel?: string;
  /** Tailwind classes for the trigger button so it can match each call site's chrome. */
  triggerClassName?: string;
  /** Extra explanatory paragraph inside the modal (e.g. "The assignee will be notified"). */
  notice?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    if (submitting) return;
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-delete-modal-title"
          >
            <h2
              id="task-delete-modal-title"
              className="mb-2 text-[16px] font-bold text-ouc-primary"
            >
              Delete task?
            </h2>
            <p className="mb-3 text-[13.5px] text-ouc-text">
              Are you sure you want to delete{' '}
              <strong className="break-words">&quot;{taskTitle}&quot;</strong>?
              This cannot be undone.
            </p>
            {notice && (
              <p className="mb-5 text-[12.5px] text-ouc-text-muted">{notice}</p>
            )}

            <form
              action={action}
              onSubmit={() => setSubmitting(true)}
            >
              <input type="hidden" name="id" value={taskId} />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className="flex-1 cursor-pointer rounded-lg border border-ouc-border bg-white py-2 text-[13px] font-semibold text-ouc-text hover:bg-ouc-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 cursor-pointer rounded-lg bg-red-600 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
