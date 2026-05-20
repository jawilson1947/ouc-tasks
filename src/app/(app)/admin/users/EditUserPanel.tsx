'use client';

import { useActionState, useEffect } from 'react';
import { updateUser } from './actions';
import type { UpdateUserState } from './actions';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
};

const initial: UpdateUserState = { ok: false };

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

export function EditUserPanel({
  user,
  onClose,
  onSaved,
}: {
  user: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateUser, initial);
  const { first, last } = splitName(user.full_name);

  useEffect(() => {
    if (state.ok) {
      onSaved();
      onClose();
    }
  }, [state.ok]);

  const fieldCls = 'w-full rounded-lg border border-ouc-border bg-white px-3 py-2 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20';
  const labelCls = 'mb-1 block text-[11.5px] font-semibold text-ouc-text-muted';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ouc-border px-5 py-4">
          <h2 className="text-[15px] font-bold text-ouc-primary">Edit User</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ouc-text-muted hover:bg-ouc-surface"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </button>
        </div>

        <form action={action} className="flex flex-1 flex-col overflow-y-auto">
          <input type="hidden" name="id" value={user.id} />

          <div className="flex flex-col gap-4 px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First name <span className="text-red-500">*</span></label>
                <input name="firstName" type="text" required defaultValue={first} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Last name <span className="text-red-500">*</span></label>
                <input name="lastName" type="text" required defaultValue={last} className={fieldCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Email <span className="text-red-500">*</span></label>
              <input name="email" type="email" required defaultValue={user.email} className={fieldCls} />
            </div>

            <div>
              <label className={labelCls}>Role <span className="text-red-500">*</span></label>
              <select name="role" defaultValue={user.role} className={fieldCls}>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="approver">Approver (can approve tasks)</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-4 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="radio" name="active" value="true" defaultChecked={user.active} className="accent-ouc-primary" />
                  Active
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="radio" name="active" value="false" defaultChecked={!user.active} className="accent-ouc-primary" />
                  Inactive
                </label>
              </div>
            </div>

            {state.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                {state.error}
              </div>
            )}
          </div>

          <div className="border-t border-ouc-border px-5 py-4">
            <button
              type="submit"
              disabled={pending}
              className="w-full cursor-pointer rounded-lg bg-ouc-primary py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-ouc-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
