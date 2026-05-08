'use server';

/**
 * Admin user-management Server Actions.
 *
 * All actions enforce admin-role check via requireAdmin() before doing
 * anything privileged. Auth-user creation and deletion go through the
 * service-role client (Supabase Admin API); the user_profile insert/update
 * also uses the service-role client to bypass RLS.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type CreateUserState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Password to share with the new user — visible exactly once. */
  tempPassword?: string;
  /** Email of the user just created — confirms which row succeeded. */
  email?: string;
  /** True if the admin chose the password explicitly (vs auto-generated). */
  adminSetPassword?: boolean;
};

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const;
type Role = (typeof VALID_ROLES)[number];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data: profile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    throw new Error('Admin role required.');
  }
  return { userId: user.id };
}

function generateTempPassword(): string {
  // 14 chars, no ambiguous I/l/0/O — easy to dictate over the phone.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 14; i++) {
    p += chars[Math.floor(Math.random() * chars.length)];
  }
  return p;
}

export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const firstName       = String(formData.get('firstName') ?? '').trim();
  const lastName        = String(formData.get('lastName')  ?? '').trim();
  const email           = String(formData.get('email')     ?? '').trim().toLowerCase();
  const role            = String(formData.get('role')      ?? '');
  const passwordInput   = String(formData.get('password')  ?? '');

  if (!firstName) return { ok: false, error: 'First name is required.' };
  if (!lastName)  return { ok: false, error: 'Last name is required.' };
  if (!email)     return { ok: false, error: 'Email is required.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Email looks invalid.' };
  }
  if (!VALID_ROLES.includes(role as Role)) {
    return { ok: false, error: 'Pick a valid role.' };
  }
  if (passwordInput && passwordInput.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const fullName = `${firstName} ${lastName}`;
  // If the admin specified a password, use it. Otherwise generate one.
  const adminSetPassword = passwordInput.length > 0;
  const tempPassword = adminSetPassword ? passwordInput : generateTempPassword();
  const admin = createAdminClient();

  // Step 1 — create the auth.users row.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
  });
  if (createErr || !created?.user) {
    return {
      ok: false,
      error: createErr?.message ?? 'Could not create the auth user.',
    };
  }

  // Step 2 — insert the user_profile row.
  const { error: profileErr } = await admin
    .from('user_profile')
    .insert({
      id: created.user.id,
      full_name: fullName,
      email,
      role,
      active: true,
    });
  if (profileErr) {
    // Roll back the auth user so we don't leave an orphan that can sign in
    // but has no profile (and therefore would fail every RLS check).
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false,
      error: `Auth user was created but profile insert failed; rolled back. (${profileErr.message})`,
    };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return {
    ok: true,
    message: adminSetPassword
      ? `Created ${fullName} (${role}) with the password you specified.`
      : `Created ${fullName} (${role}). A temporary password was generated.`,
    email,
    tempPassword,
    adminSetPassword,
  };
}

export async function deleteUser(formData: FormData) {
  let actingUserId: string;
  try {
    ({ userId: actingUserId } = await requireAdmin());
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent((e as Error).message)}`);
  }

  const targetId = String(formData.get('id') ?? '');
  if (!targetId) {
    redirect('/admin/users?error=missing-id');
  }
  if (targetId === actingUserId) {
    redirect('/admin/users?error=cannot-delete-self');
  }

  const admin = createAdminClient();
  // Cascade on auth.users → user_profile (the schema declares ON DELETE CASCADE).
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  redirect('/admin/users?deleted=1');
}

export async function updateRole(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent((e as Error).message)}`);
  }

  const targetId = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? '');

  if (!targetId) {
    redirect('/admin/users?error=missing-id');
  }
  if (!VALID_ROLES.includes(role as Role)) {
    redirect('/admin/users?error=invalid-role');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_profile')
    .update({ role })
    .eq('id', targetId);
  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?updated=1');
}
