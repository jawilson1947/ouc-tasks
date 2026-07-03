'use server';

/**
 * Contractor CRUD Server Actions.
 *
 * createContractor, updateContractor, deleteContractor.
 *
 * Authorization: admin or editor may manage contractors; viewer is blocked.
 * MySQL has no RLS, so this role gate (from the session JWT) is the ONLY
 * access control — every action checks it before touching Prisma.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole, type SessionUser } from '@/lib/auth';

async function requireWriter(): Promise<{ userId: string; role: string }> {
  let user: SessionUser;
  try {
    user = await requireRole('admin', 'editor');
  } catch (e) {
    if ((e as Error).message === 'Not authenticated') {
      throw new Error('Not authenticated.');
    }
    throw new Error('You need admin or editor role to manage contractors.');
  }
  return { userId: user.id, role: user.role };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error.';
}

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };

  return {
    businessName:     get('business_name'),
    primaryFirstName: get('primary_first_name'),
    primaryLastName:  get('primary_last_name'),
    primaryEmail:     get('primary_email'),
    primaryPhone:     get('primary_phone'),
    addressLine1:     get('address_line1'),
    addressLine2:     get('address_line2'),
    city:             get('city'),
    state:            get('state'),
    zipcode:          get('zipcode'),
    businessPhone:    get('business_phone'),
    notes:            get('notes'),
  };
}

export async function createContractor(formData: FormData) {
  let userId: string;
  try {
    ({ userId } = await requireWriter());
  } catch (e) {
    redirect(`/contractors/new?error=${encodeURIComponent(errMsg(e))}`);
  }

  const fields = readForm(formData);
  if (!fields.businessName) {
    redirect('/contractors/new?error=Business+name+is+required');
  }
  if (fields.primaryEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.primaryEmail)) {
    redirect('/contractors/new?error=Primary+email+looks+invalid');
  }

  let createdId: string;
  try {
    const created = await prisma.contractor.create({
      data: { ...fields, businessName: fields.businessName, createdById: userId },
      select: { id: true },
    });
    createdId = created.id;
  } catch (e) {
    redirect(`/contractors/new?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/contractors');
  redirect(`/contractors/${createdId}/edit?created=1`);
}

export async function updateContractor(formData: FormData) {
  try {
    await requireWriter();
  } catch (e) {
    redirect(`/contractors?error=${encodeURIComponent(errMsg(e))}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/contractors?error=Missing+contractor+id');

  const fields = readForm(formData);
  if (!fields.businessName) {
    redirect(`/contractors/${id}/edit?error=Business+name+is+required`);
  }
  if (fields.primaryEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.primaryEmail)) {
    redirect(`/contractors/${id}/edit?error=Primary+email+looks+invalid`);
  }

  try {
    await prisma.contractor.update({
      where: { id },
      data: { ...fields, businessName: fields.businessName },
    });
  } catch (e) {
    redirect(`/contractors/${id}/edit?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/contractors');
  revalidatePath(`/contractors/${id}/edit`);
  redirect(`/contractors/${id}/edit?saved=1`);
}

export async function deleteContractor(formData: FormData) {
  try {
    await requireWriter();
  } catch (e) {
    redirect(`/contractors?error=${encodeURIComponent(errMsg(e))}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/contractors?error=Missing+contractor+id');

  try {
    // task.contractor_id is ON DELETE SET NULL — linked tasks are unhooked.
    await prisma.contractor.delete({ where: { id } });
  } catch (e) {
    redirect(`/contractors?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/contractors');
  redirect('/contractors?deleted=1');
}
