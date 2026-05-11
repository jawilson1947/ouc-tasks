import Image from 'next/image';
import Link from 'next/link';
import { sendResetEmail } from './actions';

export const metadata = { title: 'Reset Password — OUC Infrastructure Tasks' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Please enter your email address.',
  failed:  'Something went wrong. Please try again.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
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

          {sent ? (
            /* ── Confirmation state ── */
            <div className="text-center">
              <div className="mb-3 text-4xl">📧</div>
              <h1 className="mb-2 text-xl font-bold text-ouc-primary">Check your inbox</h1>
              <p className="mb-6 text-[13.5px] text-ouc-text-muted">
                If that email address is registered, you&apos;ll receive a password reset link
                shortly. Check your spam folder if it doesn&apos;t arrive within a few minutes.
              </p>
              <Link
                href="/login"
                className="text-[13px] font-medium text-ouc-accent hover:underline"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Request form ── */
            <>
              <h1 className="mb-1.5 text-center text-xl font-bold text-ouc-primary">
                Reset your password
              </h1>
              <p className="mb-6 text-center text-[13.5px] text-ouc-text-muted">
                Enter the email address on your account and we&apos;ll send you a reset link.
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
                >
                  {errorMessage}
                </div>
              )}

              <form action={sendResetEmail} className="flex flex-col gap-3.5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-[12.5px] font-semibold text-ouc-text"
                  >
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

                <button
                  type="submit"
                  className="mt-1 w-full cursor-pointer rounded-lg bg-ouc-primary px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ouc-primary-hover"
                >
                  Send reset link
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
            </>
          )}
        </div>
      </div>

      <div className="px-3 pb-6 pt-4 text-center text-xs text-ouc-text-muted">
        © 2026 Oakwood University Church · tasks.oucsda.org
      </div>
    </div>
  );
}
