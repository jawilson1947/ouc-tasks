'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDateLong } from '@/lib/format';
import { deleteUser, updateRole } from './actions';
import { EditUserPanel } from './EditUserPanel';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
};

const ROLE_BADGE: Record<string, string> = {
  admin:  'bg-ouc-primary/12 text-ouc-primary',
  editor: 'bg-cat-access/12 text-cat-access',
  viewer: 'bg-ouc-surface-alt text-ouc-text-muted',
};

export function UserTableClient({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [editUser, setEditUser]       = useState<Profile | null>(null);
  const [confirmDelete, setConfirm]   = useState<Profile | null>(null);
  const [deleting, setDeleting]       = useState(false);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const fd = new FormData();
    fd.append('id', confirmDelete.id);
    await deleteUser(fd);
    setConfirm(null);
    setDeleting(false);
    router.refresh();
  }

  return (
    <>
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
            const isMe = u.id === currentUserId;
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
                    <span className="text-[11.5px] italic text-ouc-text-muted">(yourself)</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditUser(u)}
                        className="cursor-pointer rounded border border-ouc-border bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ouc-text hover:bg-ouc-surface-alt"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(u)}
                        className="cursor-pointer rounded border border-red-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Edit slide-over */}
      {editUser && (
        <EditUserPanel
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-[16px] font-bold text-ouc-primary">Delete User?</h2>
            <p className="mb-5 text-[13.5px] text-ouc-text">
              Are you sure you want to delete <strong>{confirmDelete.full_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-ouc-border bg-white py-2 text-[13px] font-semibold text-ouc-text hover:bg-ouc-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`border-b border-ouc-border px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted text-${align}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '', align = 'left' }: { children: React.ReactNode; className?: string; align?: 'left' | 'right' }) {
  return (
    <td className={`px-2.5 py-2.5 align-middle text-${align} ${className}`}>
      {children}
    </td>
  );
}
