'use server';

/**
 * Category CRUD Server Actions — createCategory, updateCategory, deleteCategory.
 * Only admins may manage reference data.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
    throw new Error('Only admins can manage categories.');
  }
  return { supabase };
}

function readName(formData: FormData): string | null {
  const v = formData.get('name');
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createCategory(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    redirect(`/settings/categories/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const name = readName(formData);
  if (!name) redirect('/settings/categories/new?error=Category+name+is+required');

  const { error } = await supabase.from('category').insert({ name });
  if (error) {
    redirect(`/settings/categories/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/settings/categories');
  revalidatePath('/tasks');
  redirect('/settings/categories?created=1');
}

export async function updateCategory(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    redirect(`/settings/categories?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/categories?error=Missing+category+id');

  const name = readName(formData);
  if (!name) redirect(`/settings/categories/${id}/edit?error=Category+name+is+required`);

  const { error } = await supabase.from('category').update({ name }).eq('id', id);
  if (error) {
    redirect(`/settings/categories/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/settings/categories');
  revalidatePath('/tasks');
  redirect(`/settings/categories/${id}/edit?saved=1`);
}

export async function deleteCategory(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    redirect(`/settings/categories?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/categories?error=Missing+category+id');

  const { error } = await supabase.from('category').delete().eq('id', id);
  if (error) {
    redirect(`/settings/categories?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/settings/categories');
  revalidatePath('/tasks');
  redirect('/settings/categories?deleted=1');
}
