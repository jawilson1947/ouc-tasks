'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const full_name = (formData.get('full_name') as string | null)?.trim() ?? '';
  const phone = (formData.get('phone') as string | null)?.trim() || null;

  if (!full_name) {
    redirect('/profile?error=Name+is+required');
  }

  const { error } = await supabase
    .from('user_profile')
    .update({ full_name, phone })
    .eq('id', user.id);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/profile?saved=1');
}
