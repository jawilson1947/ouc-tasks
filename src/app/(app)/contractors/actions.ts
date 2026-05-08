'use server';

/**
 * Contractor CRUD Server Actions.
 *
 * createContractor, updateContractor, deleteContractor.
 *
 * Authorization: admin can do anything; editor can create freely and
 * edit/delete only contractors they created. Viewer is blocked.
 * RLS enforces this at the database level; we duplicate the role gate
 * here so error messages are friendlier than "Postgres denied that".
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const ROLES_THAT_CAN_WRITE = new Set(['admin', 'editor']);

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role ?? '';
  if (!ROLES_THAT_CAN_WRITE.has(role)) {
    throw new Error('You need admin or editor role to manage contractors.');
  }
  return { supabase, userId: user.id, role };
}

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };

  return {
    business_name:        get('business_name'),
    primary_first_name:   get('primary_first_name'),
    primary_last_name:    get('primary_last_name'),
    primary_email:        get('primary_email'),
    primary_phone:        get('primary_phone'),
    address_line1:        get('address_line1'),
    address_line2:        get('address_line2'),
    city:                 get('city'),
    state:                get('state'),
    zipcode:              get('zipcode'),
    business_phone:       get('business_phone'),
    notes:                get('notes'),
  };
}

export async function createContractor(formData: FormData) {
  let userId: string;
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase, userId } = await requireWriter());
  } catch (e) {
    redirect(`/contractors/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const fields = readForm(formData);
  if (!fields.business_name) {
    redirect('/contractors/new?error=Business+name+is+required');
  }
  if (fields.primary_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.primary_email)) {
    redirect('/contractors/new?error=Primary+email+looks+invalid');
  }

  const { data: created, error } = await supabase
    .from('contractor')
    .insert({ ...fields, created_by: userId })
    .select('id')
    .single();

  if (error || !created) {
    redirect(
      `/contractors/new?error=${encodeURIComponent(error?.message ?? 'Insert failed')}`
    );
  }

  revalidatePath('/contractors');
  redirect(`/contractors/${created.id}/edit?created=1`);
}

export async function updateContractor(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/contractors?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/contractors?error=Missing+contractor+id');

  const fields = readForm(formData);
  if (!fields.business_name) {
    redirect(`/contractors/${id}/edit?error=Business+name+is+required`);
  }
  if (fields.primary_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.primary_email)) {
    redirect(`/contractors/${id}/edit?error=Primary+email+looks+invalid`);
  }

  const { error } = await supabase.from('contractor').update(fields).eq('id', id);

  if (error) {
    redirect(`/contractors/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/contractors');
  revalidatePath(`/contractors/${id}/edit`);
  redirect(`/contractors/${id}/edit?saved=1`);
}

export async function deleteContractor(formData: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireWriter());
  } catch (e) {
    redirect(`/contractors?error=${encodeURIComponent((e as Error).message)}`);
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/contractors?error=Missing+contractor+id');

  const { error } = await supabase.from('contractor').delete().eq('id', id);
  if (error) {
    redirect(`/contractors?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/contractors');
  redirect('/contractors?deleted=1');
}
