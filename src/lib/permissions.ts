/**
 * Role-based permission helpers.
 *
 * Single source of truth for "can the current user do X?" checks. The roles
 * themselves are defined in migration 0002 (admin, editor, viewer) and
 * extended in migration 0006 (approver).
 *
 * NOTE (MySQL migration): Postgres RLS is gone. These helpers — together
 * with requireRole() in src/lib/auth.ts — are now the ONLY access control
 * in the system. Every server action and API route must call them.
 *
 * Note on admin-inherits-approver: admin and approver have the same
 * effective permissions on task content, so `canApproveTasks` treats them
 * as equivalent.
 */
import { getSessionUser } from '@/lib/auth'

export type AppRole = 'admin' | 'editor' | 'approver' | 'viewer'

/**
 * Loads the current user's role from the session JWT. Returns `null` if the
 * user is not signed in. (No DB round-trip — the role is embedded in the
 * session token at sign-in.)
 */
export async function getCurrentRole(): Promise<AppRole | null> {
  const user = await getSessionUser()
  return user?.role ?? null
}

/**
 * True for admin (implicit) and approver (explicit).
 * Used to gate the "Approve Tasks" sidebar item and the /approvals routes.
 */
export function canApproveTasks(role: AppRole | null): boolean {
  return role === 'approver' || role === 'admin'
}

/** True for roles allowed to create/edit task content. */
export function canEditTasks(role: AppRole | null): boolean {
  return role === 'admin' || role === 'editor' || role === 'approver'
}

/** True only for admin — user management and settings. */
export function isAdmin(role: AppRole | null): boolean {
  return role === 'admin'
}
