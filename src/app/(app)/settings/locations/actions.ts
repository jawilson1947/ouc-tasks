'use server';

/**
 * Location CRUD Server Actions — createLocation, updateLocation, deleteLocation.
 * Only admins may manage reference data. MySQL has no RLS, so the
 * requireRole('admin') check here is the ONLY access control.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

async function requireAdmin() {
  try {
    await requireRole('admin');
  } catch (e) {
    if ((e as Error).message === 'Not authenticated') {
      throw new Error('Not authenticated.');
    }
    throw new Error('Only admins can manage locations.');
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return 'A location with that name already exists.';
  }
  return e instanceof Error ? e.message : 'Unexpected error.';
}

function readName(formData: FormData): string | null {
  const v = formData.get('name');
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createLocation(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/settings/locations/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const name = readName(formData);
  if (!name) redirect('/settings/locations/new?error=Location+name+is+required');

  try {
    await prisma.location.create({ data: { name } });
  } catch (e) {
    redirect(`/settings/locations/new?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/settings/locations');
  revalidatePath('/tasks');
  redirect('/settings/locations?created=1');
}

export async function updateLocation(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/settings/locations?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/locations?error=Missing+location+id');

  const name = readName(formData);
  if (!name) redirect(`/settings/locations/${id}/edit?error=Location+name+is+required`);

  try {
    await prisma.location.update({ where: { id }, data: { name } });
  } catch (e) {
    redirect(`/settings/locations/${id}/edit?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/settings/locations');
  revalidatePath('/tasks');
  redirect(`/settings/locations/${id}/edit?saved=1`);
}

export async function deleteLocation(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/settings/locations?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/locations?error=Missing+location+id');

  try {
    // task.location_id is ON DELETE SET NULL — tasks keep working.
    await prisma.location.delete({ where: { id } });
  } catch (e) {
    redirect(`/settings/locations?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/settings/locations');
  revalidatePath('/tasks');
  redirect('/settings/locations?deleted=1');
}
