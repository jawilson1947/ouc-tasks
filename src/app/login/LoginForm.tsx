'use client';

/**
 * Login form — client component. Calls NextAuth's credentials sign-in
 * (POST /api/auth/callback/credentials) and routes on success:
 *   • approvers always land on /approvals (their primary workflow)
 *   • everyone else goes to the `next` path (default /dashboard)
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Please enter both email and password.',
  invalid: 'Invalid email or password. Please try again.',
};

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!email || !password) {
      setError(ERROR_MESSAGES.missing);
      return;
    }

    setPending(true);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError(ERROR_MESSAGES.invalid);
      setPending(false);
      return;
    }

    // Approvers always land on the approval queue.
    const session = await getSession();
    const landing = session?.user?.role === 'approver' ? '/approvals' : next;
    router.push(landing);
    router.refresh();
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-semibold text-ouc-text">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@oucsda.org"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-ouc-border bg-white px-3 py-2.5 text-sm text-ouc-text transition-colors focus:border-ouc-accent focus:outline-none focus:ring-3 focus:ring-ouc-accent/20"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-semibold text-ouc-text">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-ouc-border bg-white px-3 py-2.5 text-sm text-ouc-text transition-colors focus:border-ouc-accent focus:outline-none focus:ring-3 focus:ring-ouc-accent/20"
          />
        </div>

        <div className="flex items-center justify-between text-[12.5px]">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-ouc-text-muted">
            <input type="checkbox" name="remember" className="accent-ouc-primary" />
            Keep me signed in
          </label>
          <Link href="/auth/forgot" className="text-ouc-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-1 w-full cursor-pointer rounded-lg bg-ouc-primary px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ouc-primary-hover disabled:cursor-default disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </>
  );
}
