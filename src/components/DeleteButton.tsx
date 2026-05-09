'use client';

/**
 * DeleteButton — a client component that shows a confirm dialog before
 * submitting a hidden delete form. Used in settings list pages which are
 * Server Components and cannot contain onClick handlers directly.
 */
import { useRef } from 'react';

export function DeleteButton({
  id,
  label,
  confirmMessage,
  action,
}: {
  id: number;
  label: string;
  confirmMessage: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        id={`delete-btn-${id}`}
        onClick={() => {
          if (confirm(confirmMessage)) {
            formRef.current?.requestSubmit();
          }
        }}
        className="cursor-pointer rounded border border-red-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50"
      >
        {label}
      </button>
    </form>
  );
}
