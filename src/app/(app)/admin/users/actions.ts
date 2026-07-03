'use server';

/**
 * Admin user-management Server Actions (Prisma / NextAuth era).
 *
 * All actions enforce the admin role via requireRole('admin') before doing
 * anything privileged — this is the application-layer replacement for the
 * old Supabase RLS + Auth Admin API.
 *
 * User creation no longer goes through an auth provider:
 *   • If the admin typed a password, it is bcrypt-hashed straight into
 *     user_profile.password_hash (same behavior as before).
 *   • Otherwise the profile is created with password_hash = NULL and a
 *     one-time setup link (/auth/reset?token=…&email=…) is generated. The
 *     sha256 hex of the raw token is stored in reset_token_hash with a
 *     48-hour expiry — matching the /auth/reset verification scheme. We try
 *     to email the link via SendGrid and also return it to the admin so it
 *     can be shared manually (shown exactly once).
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { hash as bcryptHash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { sendEmail } from '@/lib/email/sendgrid';
import { appUrl, escapeHtml, htmlShell } from '@/lib/email/templates/shared';

export type CreateUserState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Password — or one-time setup link — to share with the new user. Visible exactly once. */
  tempPassword?: string;
  /** Email of the user just created — confirms which row succeeded. */
  email?: string;
  /** True if the admin chose the password explicitly (vs invite link). */
  adminSetPassword?: boolean;
};

const VALID_ROLES = ['admin', 'editor', 'approver', 'viewer'] as const;
type Role = (typeof VALID_ROLES)[number];

const RESET_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const BCRYPT_ROUNDS = 12;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error.';
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/** Build the one-time password-setup link and its stored hash/expiry. */
function makeSetupLink(email: string): {
  link: string;
  resetTokenHash: string;
  resetTokenExpires: Date;
} {
  const raw = randomBytes(32).toString('hex');
  return {
    link: `${appUrl()}/auth/reset?token=${raw}&email=${encodeURIComponent(email)}`,
    resetTokenHash: createHash('sha256').update(raw).digest('hex'),
    resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

/** Best-effort invite email — DB write already committed, so never throw. */
async function sendInviteEmail(args: {
  to: string;
  fullName: string;
  link: string;
}): Promise<boolean> {
  const bodyHtml = `
    <p>Hi ${escapeHtml(args.fullName)},</p>
    <p>An account has been created for you on <strong>OUC Infrastructure Tasks</strong>.</p>
    <p>Set your password using the link below (valid for 48 hours):</p>
    <p><a href="${args.link}" style="display:inline-block;background:#333F48;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Set your password</a></p>
    <p style="color:#6B7480;font-size:12px;">If the button doesn't work, paste this into your browser:<br>${escapeHtml(args.link)}</p>`;
  const result = await sendEmail({
    to: args.to,
    subject: 'You’ve been invited to OUC Infrastructure Tasks',
    html: htmlShell({ title: 'Set your password', bodyHtml }),
    text: `An account has been created for you on OUC Infrastructure Tasks.\n\nSet your password (link valid for 48 hours):\n${args.link}\n`,
  });
  return result.ok;
}

export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  try {
    await requireRole('admin');
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }

  const firstName     = String(formData.get('firstName') ?? '').trim();
  const lastName      = String(formData.get('lastName')  ?? '').trim();
  const email         = String(formData.get('email')     ?? '').trim().toLowerCase();
  const role          = String(formData.get('role')      ?? '');
  const passwordInput = String(formData.get('password')  ?? '');

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
  const adminSetPassword = passwordInput.length > 0;

  // If the admin specified a password, hash it in directly. Otherwise leave
  // password_hash NULL and issue a one-time setup link (invite flow).
  const setup = adminSetPassword ? null : makeSetupLink(email);

  try {
    await prisma.userProfile.create({
      data: {
        id: randomUUID(),
        fullName,
        email,
        role: role as Role,
        active: true,
        passwordHash: adminSetPassword
          ? await bcryptHash(passwordInput, BCRYPT_ROUNDS)
          : null,
        resetTokenHash: setup?.resetTokenHash ?? null,
        resetTokenExpires: setup?.resetTokenExpires ?? null,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: `A user with the email ${email} already exists.` };
    }
    return { ok: false, error: errMsg(e) };
  }

  // Invite flow — try to email the setup link; always surface it to the admin.
  let emailed = false;
  if (setup) {
    emailed = await sendInviteEmail({ to: email, fullName, link: setup.link });
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return {
    ok: true,
    message: adminSetPassword
      ? `Created ${fullName} (${role}) with the password you specified.`
      : emailed
        ? `Created ${fullName} (${role}). A password-setup link was emailed to them — the same one-time link is below (valid 48 hours).`
        : `Created ${fullName} (${role}). Share the one-time password-setup link below (valid 48 hours).`,
    email,
    tempPassword: adminSetPassword ? passwordInput : setup!.link,
    adminSetPassword,
  };
}

export async function deleteUser(formData: FormData) {
  let actingUserId: string;
  try {
    ({ id: actingUserId } = await requireRole('admin'));
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent(errMsg(e))}`);
  }

  const targetId = String(formData.get('id') ?? '');
  if (!targetId) {
    redirect('/admin/users?error=missing-id');
  }
  if (targetId === actingUserId) {
    redirect('/admin/users?error=cannot-delete-self');
  }

  try {
    // Hard delete — FKs on task/contractor/etc. are ON DELETE SET NULL, and
    // comments cascade, mirroring the old auth.users → user_profile cascade.
    await prisma.userProfile.delete({ where: { id: targetId } });
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  redirect('/admin/users?deleted=1');
}

export type UpdateUserState = {
  ok: boolean;
  error?: string;
};

export async function updateUser(
  _prev: UpdateUserState,
  formData: FormData
): Promise<UpdateUserState> {
  try {
    await requireRole('admin');
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }

  const targetId        = String(formData.get('id')              ?? '').trim();
  const firstName       = String(formData.get('firstName')       ?? '').trim();
  const lastName        = String(formData.get('lastName')        ?? '').trim();
  const email           = String(formData.get('email')           ?? '').trim().toLowerCase();
  const role            = String(formData.get('role')            ?? '');
  const active          = formData.get('active') === 'true';
  const password        = String(formData.get('password')        ?? '');
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

  if (!targetId)  return { ok: false, error: 'Missing user id.' };
  if (!firstName) return { ok: false, error: 'First name is required.' };
  if (!lastName)  return { ok: false, error: 'Last name is required.' };
  if (!email)     return { ok: false, error: 'Email is required.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Email looks invalid.' };
  }
  if (!VALID_ROLES.includes(role as Role)) {
    return { ok: false, error: 'Pick a valid role.' };
  }
  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      return { ok: false, error: 'Passwords do not match.' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters.' };
    }
  }

  const fullName = `${firstName} ${lastName}`;

  const data: Prisma.UserProfileUpdateInput = { fullName, email, role: role as Role, active };
  if (password) {
    // Setting a password directly also clears any outstanding setup link.
    data.passwordHash = await bcryptHash(password, BCRYPT_ROUNDS);
    data.resetTokenHash = null;
    data.resetTokenExpires = null;
  }

  try {
    await prisma.userProfile.update({ where: { id: targetId }, data });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: `Another user already uses the email ${email}.` };
    }
    return { ok: false, error: errMsg(e) };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { ok: true };
}

export async function updateRole(formData: FormData) {
  try {
    await requireRole('admin');
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent(errMsg(e))}`);
  }

  const targetId = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? '');

  if (!targetId) {
    redirect('/admin/users?error=missing-id');
  }
  if (!VALID_ROLES.includes(role as Role)) {
    redirect('/admin/users?error=invalid-role');
  }

  try {
    await prisma.userProfile.update({
      where: { id: targetId },
      data: { role: role as Role },
    });
  } catch (e) {
    redirect(`/admin/users?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?updated=1');
}
