/**
 * Authenticated app layout — sidebar + topbar + content area.
 *
 * Wraps every page under src/app/(app)/. Route group parentheses mean the
 * folder name doesn't appear in URLs: /dashboard, /tasks, etc.
 *
 * The proxy redirects unauthenticated visitors to /login before they ever
 * hit this layout, but we double-check here as defense in depth.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/Sidebar';

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Pull display name from user_profile if it exists, else fall back to email.
  const { data: profile } = await supabase
    .from('user_profile')
    .select('full_name, email, role')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.full_name ?? user.email ?? 'User';
  const initials = initialsFrom(displayName);

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-ouc-surface">
      <Sidebar displayName={displayName} />

      <main className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-ouc-border bg-white px-7 py-3.5">
          <div className="relative max-w-[480px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] opacity-50">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search tasks, sub-tasks, vendors, locations…"
              className="w-full rounded-lg border border-ouc-border bg-ouc-surface px-3 py-2 pl-9 text-[13.5px] text-ouc-text focus:bg-white focus:outline focus:outline-2 focus:outline-ouc-accent"
            />
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/tasks"
              className="rounded-lg border border-ouc-border bg-white px-3.5 py-2 text-[13.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
            >
              Filters
            </Link>
            <Link
              href="/tasks/new"
              className="rounded-lg bg-ouc-primary px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-ouc-primary-hover"
            >
              + New Task
            </Link>
            <div className="flex items-center gap-2 border-l border-ouc-border pl-3">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ouc-accent text-xs font-semibold text-white"
                title={displayName}
              >
                {initials}
              </span>
              <span className="text-[13px] font-medium text-ouc-text">{displayName}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg border border-ouc-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
                >
                  Log Off
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="max-w-[1400px] p-7">{children}</div>
      </main>
    </div>
  );
}
