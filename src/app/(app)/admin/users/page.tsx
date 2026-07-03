/**
 * /admin/users — User management page.
 *
 * Lists every user_profile row, lets admins create new users, change roles,
 * and delete users. Non-admins see a read-only view (the form is disabled).
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NewUserForm } from './NewUserForm';
import { UserTableClient } from './UserTableClient';

export const metadata = { title: 'Users — Admin — OUC Infrastructure Tasks' };

const FLASH_ERROR_MESSAGES: Record<string, string> = {
  'missing-id':         'Missing user id.',
  'cannot-delete-self': 'You can’t delete the account you’re signed in as.',
  'invalid-role':       'Invalid role.',
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
};

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string; updated?: string }>;
}) {
  const params = await searchParams;

  const me = await getSessionUser();
  if (!me) redirect('/login');

  const isAdmin = me.role === 'admin';
  if (!isAdmin) {
    return (
      <div className="rounded-[10px] border border-ouc-border bg-white px-6 py-10 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-ouc-primary">User Management</h1>
        <p className="mx-auto max-w-md text-[13.5px] text-ouc-text-muted">
          You need the <strong>admin</strong> role to manage users. Your current
          role is <strong>{me.role ?? '(none)'}</strong>. Ask an existing
          admin to elevate your account.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-block text-ouc-accent hover:underline"
        >
          ← Back to Admin
        </Link>
      </div>
    );
  }

  const usersData = await prisma.userProfile.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      active: true,
      lastLogin: true,
      createdAt: true,
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });

  const users: Profile[] = usersData.map((u) => ({
    id: u.id,
    full_name: u.fullName,
    email: u.email,
    role: u.role,
    active: u.active,
    last_login: u.lastLogin ? u.lastLogin.toISOString() : null,
    created_at: u.createdAt.toISOString(),
  }));
  const errorMessage = params.error
    ? FLASH_ERROR_MESSAGES[params.error] ?? params.error
    : null;

  const counts = {
    admin:    users.filter((u) => u.role === 'admin').length,
    editor:   users.filter((u) => u.role === 'editor').length,
    approver: users.filter((u) => u.role === 'approver').length,
    viewer:   users.filter((u) => u.role === 'viewer').length,
    other:    users.filter((u) => !['admin', 'editor', 'approver', 'viewer'].includes(u.role)).length,
  };

  return (
    <div>
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/admin" className="hover:text-ouc-primary">Admin</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Users</span>
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">User Management</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {users.length} user{users.length === 1 ? '' : 's'} ·{' '}
            {counts.admin} admin · {counts.editor} editor · {counts.approver} approver · {counts.viewer} viewer
            {counts.other > 0 && ` · ${counts.other} legacy role`}
          </div>
        </div>
      </div>

      {/* Flash messages */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
        >
          {errorMessage}
        </div>
      )}
      {params.deleted && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          User deleted.
        </div>
      )}
      {params.updated && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Role updated.
        </div>
      )}

      {/* Add user form */}
      <div className="mb-6">
        <NewUserForm />
      </div>

      {/* User list */}
      <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
        <h2 className="mb-3 text-[15px] font-bold text-ouc-primary">All users</h2>

        {users.length === 0 ? (
          <div className="py-6 text-center text-sm text-ouc-text-muted">
            No users yet. Add the first one with the form above.
          </div>
        ) : (
          <UserTableClient users={users} currentUserId={me.id} />
        )}
      </section>
    </div>
  );
}

