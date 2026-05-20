/**
 * Role-based permission helpers.
 *
 * Single source of truth for "can the current user do X?" checks. The roles
 * themselves are defined in migration 0002 (admin, editor, viewer) and
 * extended in migration 0006 (approver).
 *
 * Note on admin-inherits-approver: the task RLS policies in 0006 grant
 * `task_approver_all` to role='approver' only, and the existing
 * `task_admin_all` to role='admin'. Both end up with the same effective
 * permissions on the task table, so `canApproveTasks` treats them as equivalent.
 */
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'editor' | 'approver' | 'viewer';

/**
 * Loads the current user's role from `user_profile`. Returns `null` if the
 * user is not signed in or has no profile row.
 *
 * Callers that need the supabase client too should call `createClient()`
 * themselves rather than have this helper return both — it keeps the call
 * sites tidy and lets each caller decide whether to await getUser().
 */
export async function getCurrentRole(): Promise<AppRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile?.role ?? null) as AppRole | null;
  return role;
}

/**
 * True for admin (implicit) and approver (explicit).
 * Used to gate the "Approve Tasks" sidebar item and the /approvals routes.
 */
export function canApproveTasks(role: AppRole | null): boolean {
  return role === 'approver' || role === 'admin';
}
