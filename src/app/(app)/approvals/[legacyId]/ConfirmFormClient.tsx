'use client';

/**
 * ConfirmFormClient — client-side wrapper for a server-action form button that
 * pops a native confirm() dialog before submitting. Used by the approver
 * actions footer (Revoke, Delete).
 *
 * Mirrors the pattern in src/components/DeleteButton.tsx but accepts a string
 * task id (uuid) instead of a numeric id.
 */
import { useRef } from 'react';

export function ConfirmFormClient({
  action,
  id,
  label,
  confirmMessage,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label: string;
  confirmMessage: string;
  className: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        onClick={() => {
          if (confirm(confirmMessage)) {
            formRef.current?.requestSubmit();
          }
        }}
        className={className}
      >
        {label}
      </button>
    </form>
  );
}
