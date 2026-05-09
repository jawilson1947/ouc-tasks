'use server';

/**
 * Location CRUD Server Actions — createLocation, updateLocation, deleteLocation.
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
    throw new Error('Only admins can manage locations.');
  }
  return { supabase };
}

function readName(formData: FormData): string | null {
  const v = formData.get('name');
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createLocation(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    redirect(`/settings/locations/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const name = readName(formData);
  if (!name) redirect('/settings/locations/new?error=Location+name+is+required');

  const { error } = await supabase.from('location').insert({ name });
  if (error) {
    redirect(`/settings/locations/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/settings/locations');
  revalidatePath('/tasks');
  redirect('/settings/locations?created=1');
}

export async function updateLocation(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    redirect(`/settings/locations?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/locations?error=Missing+location+id');

  const name = readName(formData);
  if (!name) redirect(`/settings/locations/${id}/edit?error=Location+name+is+required`);

  const { error } = await supabase.from('location').update({ name }).eq('id', id);
  if (error) {
    redirect(`/settings/locations/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/settings/locations');
  revalidatePath('/tasks');
  redirect(`/settings/locations/${id}/edit?saved=1`);
}

export async function deleteLocation(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    redirect(`/settings/locations?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = Number(String(formData.get('id') ?? '').trim());
  if (!id) redirect('/settings/locations?error=Missing+location+id');

  const { error } = await supabase.from('location').delete().eq('id', id);
  if (error) {
    redirect(`/settings/locations?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/settings/locations');
  revalidatePath('/tasks');
  redirect('/settings/locations?deleted=1');
}
