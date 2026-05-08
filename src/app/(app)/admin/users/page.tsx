/**
 * /admin/users — User management page.
 *
 * Lists every user_profile row, lets admins create new users, change roles,
 * and delete users. Non-admins see a read-only view (the form is disabled).
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fmtDateLong } from '@/lib/format';
import { NewUserForm } from './NewUserForm';
import { deleteUser, updateRole } from './actions';

export const metadata = { title: 'Users — Admin — OUC Infrastructure Tasks' };

const ROLE_BADGE: Record<string, string> = {
  admin:  'bg-ouc-primary/12 text-ouc-primary',
  editor: 'bg-cat-access/12 text-cat-access',
  viewer: 'bg-ouc-surface-alt text-ouc-text-muted',
};

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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: meProfile } = await supabase
    .from('user_profile')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = meProfile?.role === 'admin';
  if (!isAdmin) {
    return (
      <div className="rounded-[10px] border border-ouc-border bg-white px-6 py-10 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-ouc-primary">User Management</h1>
        <p className="mx-auto max-w-md text-[13.5px] text-ouc-text-muted">
          You need the <strong>admin</strong> role to manage users. Your current
          role is <strong>{meProfile?.role ?? '(none)'}</strong>. Ask an existing
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

  const { data: usersData, error: usersErr } = await supabase
    .from('user_profile')
    .select('id, full_name, email, role, active, last_login, created_at')
    .order('role')
    .order('full_name');

  const users = (usersData ?? []) as Profile[];
  const errorMessage = params.error
    ? FLASH_ERROR_MESSAGES[params.error] ?? params.error
    : null;

  const counts = {
    admin:  users.filter((u) => u.role === 'admin').length,
    editor: users.filter((u) => u.role === 'editor').length,
    viewer: users.filter((u) => u.role === 'viewer').length,
    other:  users.filter((u) => !['admin', 'editor', 'viewer'].includes(u.role)).length,
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
            {counts.admin} admin · {counts.editor} editor · {counts.viewer} viewer
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

        {usersErr ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load users: {usersErr.message}
          </div>
        ) : users.length === 0 ? (
          <div className="py-6 text-center text-sm text-ouc-text-muted">
            No users yet. Add the first one with the form above.
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Created</Th>
                <Th>Last login</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === user.id;
                return (
                  <tr key={u.id} className="border-b border-ouc-border last:border-b-0 align-middle">
                    <Td className="font-semibold text-ouc-text">
                      {u.full_name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-ouc-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ouc-text-muted">
                          You
                        </span>
                      )}
                    </Td>
                    <Td>
                      <a href={`mailto:${u.email}`} className="text-ouc-accent hover:underline">
                        {u.email}
                      </a>
                    </Td>
                    <Td>
                      <form action={updateRole} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          className={`rounded-full border-0 px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-ouc-accent/30 ${
                            ROLE_BADGE[u.role] ?? 'bg-ouc-surface-alt text-ouc-text-muted'
                          }`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                          {!['admin', 'editor', 'viewer'].includes(u.role) && (
                            <option value={u.role}>{u.role} (legacy)</option>
                          )}
                        </select>
                        <button
                          type="submit"
                          className="cursor-pointer rounded border border-ouc-border bg-white px-1.5 py-0.5 text-[11px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
                          title="Save role change"
                        >
                          Save
                        </button>
                      </form>
                    </Td>
                    <Td className="text-ouc-text-muted">{fmtDateLong(u.created_at)}</Td>
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
                    <Td align="right">
                      {isMe ? (
                        <span className="text-[11.5px] italic text-ouc-text-muted">
                          (yourself)
                        </span>
                      ) : (
                        <form action={deleteUser} className="inline-block">
                          <input type="hidden" name="id" value={u.id} />
                          <button
                            type="submit"
                            className="cursor-pointer rounded border border-red-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-red-700 hover:bg-red-50"
                            title={`Delete ${u.full_name}`}
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`border-b border-ouc-border px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={`px-2.5 py-2.5 align-middle ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}
