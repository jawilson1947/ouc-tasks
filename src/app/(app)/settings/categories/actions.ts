'use server';

/**
 * Category CRUD Server Actions — createCategory, updateCategory, deleteCategory.
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
    throw new Error('Only admins can manage categories.');
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return 'A category with that name already exists.';
  }
  return e instanceof Error ? e.message : 'Unexpected error.';
}

function readName(formData: FormData): string | null {
  const v = formData.get('name');
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createCategory(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/settings/categories/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const name = readName(formData);
  if (!name) redirect('/settings/categories/new?error=Category+name+is+required');

  try {
    await prisma.category.create({ data: { name } });
  } catch (e) {
    redirect(`/settings/categories/new?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/settings/categories');
  revalidatePath('/tasks');
  redirect('/settings/categories?created=1');
}

export async function updateCategory(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/settings/categories?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/categories?error=Missing+category+id');

  const name = readName(formData);
  if (!name) redirect(`/settings/categories/${id}/edit?error=Category+name+is+required`);

  try {
    await prisma.category.update({ where: { id }, data: { name } });
  } catch (e) {
    redirect(`/settings/categories/${id}/edit?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/settings/categories');
  revalidatePath('/tasks');
  redirect(`/settings/categories/${id}/edit?saved=1`);
}

export async function deleteCategory(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    redirect(`/settings/categories?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/categories?error=Missing+category+id');

  try {
    // task.category_id is ON DELETE SET NULL — tasks keep working.
    await prisma.category.delete({ where: { id } });
  } catch (e) {
    redirect(`/settings/categories?error=${encodeURIComponent(errMsg(e))}`);
  }

  revalidatePath('/settings/categories');
  revalidatePath('/tasks');
  redirect('/settings/categories?deleted=1');
}
