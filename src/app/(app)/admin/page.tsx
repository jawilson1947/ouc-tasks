/**
 * Admin — Server Component overview page.
 * V1 scope: read-only inventory of users, categories, locations.
 * Edit / invite flows are deferred (each needs Server Actions and forms).
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fmtDateLong } from '@/lib/format';

export const metadata = { title: 'Admin — OUC Infrastructure Tasks' };

const ROLE_BADGE: Record<string, string> = {
  admin:      'bg-ouc-primary/12 text-ouc-primary',
  editor:     'bg-cat-access/12 text-cat-access',
  viewer:     'bg-ouc-surface-alt text-ouc-text-muted',
  // Legacy values still appear if migration hasn't run yet:
  staff:      'bg-cat-access/12 text-cat-access',
  contractor: 'bg-cat-maintenance/12 text-cat-maintenance',
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  last_login: string | null;
};

type Category = { id: number; name: string; color_hex: string | null; sort_order: number };
type Location = { id: number; name: string; building: string | null; sort_order: number };

export default async function AdminPage() {
  // Defense-in-depth role check. The role lives in the session JWT — no DB
  // round-trip. We hide write affordances and gate the page itself.
  const me = await getSessionUser();
  if (!me) redirect('/login');

  const isAdmin = me.role === 'admin';

  const [usersData, cats, locs, taskCount, subtaskCount, receiptCount] =
    await Promise.all([
      prisma.userProfile.findMany({
        select: { id: true, fullName: true, email: true, role: true, active: true, lastLogin: true },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      }),
      prisma.category.findMany({
        select: { id: true, name: true, colorHex: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.location.findMany({
        select: { id: true, name: true, building: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.task.count(),
      prisma.subtask.count(),
      prisma.attachment.count({ where: { type: 'receipt' } }),
    ]);

  const users: Profile[] = usersData.map((u) => ({
    id: u.id,
    full_name: u.fullName,
    email: u.email,
    role: u.role,
    active: u.active,
    last_login: u.lastLogin ? u.lastLogin.toISOString() : null,
  }));
  const categories: Category[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    color_hex: c.colorHex,
    sort_order: c.sortOrder,
  }));
  const locations: Location[] = locs.map((l) => ({
    id: l.id,
    name: l.name,
    building: l.building,
    sort_order: l.sortOrder,
  }));

  const activeUsers = users.filter((u) => u.active).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold text-ouc-primary">Admin</h1>
        <div className="text-[13.5px] text-ouc-text-muted">
          {isAdmin
            ? 'System inventory and reference data.'
            : 'Read-only — admin role required to make changes.'}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Users" value={`${activeUsers} / ${users.length}`} hint={`${activeUsers} active`} />
        <Stat label="Tasks" value={taskCount ?? 0} />
        <Stat label="Sub-tasks" value={subtaskCount ?? 0} />
        <Stat label="Receipts" value={receiptCount ?? 0} />
      </div>

      {/* Users */}
      <Section
        title="Users"
        subtitle={`${users.length} total`}
        actionHref={isAdmin ? '/admin/users' : undefined}
        actionLabel="Manage →"
      >
        <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last login</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ouc-border last:border-b-0">
                  <Td className="font-semibold text-ouc-text">{u.full_name}</Td>
                  <Td>
                    <a href={`mailto:${u.email}`} className="text-ouc-accent hover:underline">
                      {u.email}
                    </a>
                  </Td>
                  <Td>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold uppercase tracking-wider ${
                        ROLE_BADGE[u.role] ?? 'bg-ouc-surface-alt text-ouc-text-muted'
                      }`}
                    >
                      {u.role}
                    </span>
                  </Td>
                  <Td className="text-ouc-text-muted">
                    {u.last_login ? fmtDateLong(u.last_login) : 'Never'}
                  </Td>
                  <Td>
                    {u.active ? (
                      <span className="text-status-done">Active</span>
                    ) : (
                      <span className="text-ouc-text-muted">Inactive</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
        </table>
      </Section>

      {/* Categories + Locations side by side */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Categories" subtitle={`${categories.length} total`}>
          <ul className="flex flex-col gap-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border-b border-ouc-border pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-block h-3 w-3 rounded"
                      style={{ background: c.color_hex ?? '#6B7280' }}
                    />
                    <span className="text-[13px] font-medium">{c.name}</span>
                  </div>
                  <span className="text-[11.5px] text-ouc-text-muted tabular-nums">
                    sort {c.sort_order}
                  </span>
                </li>
              ))}
          </ul>
        </Section>

        <Section title="Locations" subtitle={`${locations.length} total`}>
          <ul className="flex flex-col gap-2">
              {locations.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between border-b border-ouc-border pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-[13px] font-medium">{l.name}</span>
                  <span className="text-[11.5px] text-ouc-text-muted">
                    {l.building ?? '—'}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local components
// ---------------------------------------------------------------------------

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-[10px] border border-ouc-border bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-ouc-text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-ouc-text">{value}</div>
      {hint && <div className="mt-1 text-xs text-ouc-text-muted">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  actionHref,
  actionLabel = '+ Add',
  children,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-ouc-primary">{title}</h2>
          {subtitle && <div className="text-[11.5px] text-ouc-text-muted">{subtitle}</div>}
        </div>
        {actionHref ? (
          <Link
            href={actionHref}
            className="rounded-md border border-ouc-border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ouc-text hover:bg-ouc-surface-alt"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-md border border-ouc-border bg-white px-2.5 py-1 text-[11.5px] font-medium text-ouc-text-muted opacity-60"
          >
            {actionLabel}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-ouc-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-2.5 align-middle ${className}`}>{children}</td>;
}
