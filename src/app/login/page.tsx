/**
 * Login page — public, rendered when the proxy redirects unauthenticated
 * users here. Visual spec: docs/mockups/login.html.
 *
 * Server Component. The form posts to the `signIn` Server Action, which
 * either redirects to `next` on success or back here with `?error=`.
 */
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signIn } from './actions';

export const metadata = { title: 'Sign in — OUC Infrastructure Tasks' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Please enter both email and password.',
  invalid: 'Invalid email or password. Please try again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '/dashboard', error } = await searchParams;

  // If the user is already signed in, skip straight to their destination.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next);

  const errorMessage = error ? ERROR_MESSAGES[error] ?? 'Sign-in failed.' : null;

  return (
    <div className="flex min-h-screen flex-col bg-ouc-surface">
      {/* Subtle decorative top band in brand color */}
      <div className="h-1.5 bg-gradient-to-r from-ouc-primary via-[#4A5762] to-ouc-primary" />

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md rounded-xl border border-ouc-border bg-white px-8 pt-9 pb-7 shadow-[0_12px_40px_rgba(26,31,37,.10),0_4px_12px_rgba(26,31,37,.06)]">

          <div className="mb-6 flex flex-col items-center">
            <Image
              src="/logos/ouc-full-pms432.png"
              alt="Oakwood University Church"
              width={300}
              height={110}
              className="mb-3.5 max-h-[110px] w-auto"
              priority
            />
            <div className="text-center text-[13px] font-semibold uppercase tracking-[.08em] text-ouc-text-muted">
              Infrastructure Task
              <br />
              Manager
            </div>
          </div>

          <h1 className="mb-1.5 text-center text-xl font-bold text-ouc-primary">
            Sign in to your account
          </h1>
          <p className="mb-6 text-center text-[13.5px] text-ouc-text-muted">
            Welcome back. Sign in to manage tasks, track costs, and collaborate with your team.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form action={signIn} className="flex flex-col gap-3.5">
            <input type="hidden" name="next" value={next} />

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
                <input
                  type="checkbox"
                  name="remember"
                  className="accent-ouc-primary"
                />
                Keep me signed in
              </label>
              <Link href="/auth/forgot" className="text-ouc-accent hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="mt-1 w-full cursor-pointer rounded-lg bg-ouc-primary px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ouc-primary-hover"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-ouc-text-muted">
            Don&apos;t have an account? Contact your administrator to be invited.
          </div>
        </div>
      </div>

      <div className="px-3 pb-6 pt-4 text-center text-xs text-ouc-text-muted">
        © 2026 Oakwood University Church · tasks.oucsda.org
      </div>
    </div>
  );
}
