'use client';

/**
 * RequestApprovalButton — small client component rendered immediately to the
 * left of the Cancel link in the edit-page footer (via TaskForm's
 * `requestApprovalSlot` prop). Pops a native confirm() every click — first
 * time and every time after; no throttling — and on Yes, invokes the
 * `requestApproval` server action.
 *
 * We use a plain `<button type="button">` (not a form submit) so it nests
 * cleanly inside the outer `<form action={updateTask}>` without HTML form
 * nesting. The action is invoked directly from `useTransition` with a
 * FormData payload carrying the task id + legacy id.
 *
 * Styling: matches the white/border look of the Cancel link, with an accent
 * tint so it reads as an "action" rather than a "cancel/back".
 */
import { useTransition } from 'react';
import { requestApproval } from '@/app/(app)/tasks/request-approval-action';

export function RequestApprovalButton({
  taskId,
  legacyId,
}: {
  taskId: string;
  legacyId: number;
}) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm('Send an approval request to all active approvers?')) return;
    const fd = new FormData();
    fd.set('id', taskId);
    fd.set('legacy_id', String(legacyId));
    startTransition(() => {
      // requestApproval issues a `redirect()` on completion — that's how the
      // banner flag (?approversNotified=1 / ?noApprovers=1) gets into the URL.
      void requestApproval(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="cursor-pointer rounded-md border border-ouc-accent bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ouc-accent hover:bg-ouc-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? 'Requesting…' : 'Request Approval'}
    </button>
  );
}
