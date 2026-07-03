/**
 * Login page — public, rendered when the proxy redirects unauthenticated
 * users here. Visual spec: docs/mockups/login.html.
 *
 * Server Component shell; the interactive form lives in LoginForm.tsx
 * (client component) which signs in via NextAuth credentials.
 */
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in — OUC Infrastructure Tasks' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const { next = '/dashboard', reset } = await searchParams;

  // If the user is already signed in, skip straight to their destination.
  const session = await auth();
  if (session?.user?.id) redirect(next);

  const resetSuccess = reset === '1';

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

          {resetSuccess && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-700"
            >
              Password updated. Sign in with your new password.
            </div>
          )}

          <LoginForm next={next} />

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
