'use client';

/**
 * New-user form for /admin/users. Client Component because it uses
 * useActionState to display errors and the temp password inline after
 * the Server Action returns.
 */
import { useActionState, useEffect, useRef, useState } from 'react';
import { createUser, type CreateUserState } from './actions';

const INITIAL: CreateUserState = { ok: false };

export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUser, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState(false);

  // Reset the form fields after a successful create.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setCopied(false);
    }
  }, [state]);

  async function copyPassword() {
    if (!state.tempPassword) return;
    try {
      await navigator.clipboard.writeText(state.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — user can select-and-copy manually
    }
  }

  return (
    <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
      <h2 className="mb-3 text-[15px] font-bold text-ouc-primary">Add a user</h2>

      <form
        ref={formRef}
        action={formAction}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_140px]"
      >
        <Field label="First name">
          <input
            name="firstName"
            type="text"
            required
            disabled={pending}
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </Field>
        <Field label="Last name">
          <input
            name="lastName"
            type="text"
            required
            disabled={pending}
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            placeholder="user@oucsda.org"
            disabled={pending}
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </Field>
        <Field label="Role">
          <select
            name="role"
            required
            defaultValue="viewer"
            disabled={pending}
            className="w-full rounded-md border border-ouc-border bg-white px-2 py-1.5 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </Field>
        <Field label="Password (optional — auto-generated if blank)" className="lg:col-span-3">
          <input
            name="password"
            type="text"
            minLength={8}
            placeholder="Leave blank to auto-generate a 14-char password"
            autoComplete="new-password"
            disabled={pending}
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 font-mono text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-md bg-ouc-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? 'Adding…' : 'Add user'}
          </button>
        </div>
      </form>

      {/* Error */}
      {state.error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* Success — show password ONCE */}
      {state.ok && state.tempPassword && (
        <div className="mt-3 rounded-md border border-green-300 bg-green-50 p-3 text-[13px] text-green-900">
          <div className="font-semibold">{state.message}</div>
          <div className="mt-2">
            {state.adminSetPassword
              ? <>The password you specified is set on <span className="font-mono">{state.email}</span>.</>
              : <>Share this auto-generated password with <span className="font-mono">{state.email}</span>.</>
            }{' '}
            They should sign in and change it. This is shown once.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded border border-green-200 bg-white px-2 py-1.5 font-mono text-[13px] text-ouc-text">
              {state.tempPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              className="cursor-pointer rounded-md border border-green-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-green-900 hover:bg-green-100"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
