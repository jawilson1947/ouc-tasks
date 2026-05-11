import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updatePassword } from './actions';

export const metadata = { title: 'Set New Password — OUC Infrastructure Tasks' };

const ERROR_MESSAGES: Record<string, string> = {
  weak:     'Password must be at least 8 characters.',
  mismatch: 'Passwords do not match.',
  failed:   'Something went wrong. Please request a new reset link.',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Confirm the user arrived here via a valid reset link (session is present
  // and was established by /auth/callback exchanging the PKCE code).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // No valid session — the link has expired or was already used.
    redirect('/auth/forgot?error=expired');
  }

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'An error occurred.') : null;

  return (
    <div className="flex min-h-screen flex-col bg-ouc-surface">
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
            Set a new password
          </h1>
          <p className="mb-6 text-center text-[13.5px] text-ouc-text-muted">
            Choose a strong password for your account.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form action={updatePassword} className="flex flex-col gap-3.5">
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12.5px] font-semibold text-ouc-text"
              >
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-ouc-border bg-white px-3 py-2.5 text-sm text-ouc-text transition-colors focus:border-ouc-accent focus:outline-none focus:ring-3 focus:ring-ouc-accent/20"
              />
              <p className="mt-1 text-[11.5px] text-ouc-text-muted">Minimum 8 characters.</p>
            </div>

            <div>
              <label
                htmlFor="confirmation"
                className="mb-1.5 block text-[12.5px] font-semibold text-ouc-text"
              >
                Confirm new password
              </label>
              <input
                id="confirmation"
                name="confirmation"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-ouc-border bg-white px-3 py-2.5 text-sm text-ouc-text transition-colors focus:border-ouc-accent focus:outline-none focus:ring-3 focus:ring-ouc-accent/20"
              />
            </div>

            <button
              type="submit"
              className="mt-1 w-full cursor-pointer rounded-lg bg-ouc-primary px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ouc-primary-hover"
            >
              Update password
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-[13px] font-medium text-ouc-accent hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="px-3 pb-6 pt-4 text-center text-xs text-ouc-text-muted">
        © 2026 Oakwood University Church · tasks.oucsda.org
      </div>
    </div>
  );
}
