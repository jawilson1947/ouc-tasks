import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateUserEmail, updateUserName } from '../../actions';

export const metadata = { title: 'Edit User — Admin — OUC Infrastructure Tasks' };

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: { user: me } } = await supabase.auth.getUser();
  if (!me) redirect('/login');

  const { data: meProfile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', me.id)
    .maybeSingle();

  if (meProfile?.role !== 'admin') redirect('/admin/users');

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('user_profile')
    .select('id, full_name, email, role, phone, active')
    .eq('id', id)
    .maybeSingle();

  if (error || !profile) notFound();

  const savedMsg =
    sp.saved === 'email'   ? 'Email updated.' :
    sp.saved === 'profile' ? 'Profile saved.' :
    null;

  return (
    <div>
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/admin" className="hover:text-ouc-primary">Admin</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <Link href="/admin/users" className="hover:text-ouc-primary">Users</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Edit</span>
      </div>
      <h1 className="mb-5 text-2xl font-bold text-ouc-primary">
        Edit User: {profile.full_name}
      </h1>

      {sp.error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
        >
          {sp.error}
        </div>
      )}
      {savedMsg && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          {savedMsg}
        </div>
      )}

      <div className="flex max-w-lg flex-col gap-5">
        {/* Name & phone */}
        <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm">
          <h2 className="mb-4 text-[14px] font-bold text-ouc-primary">Profile</h2>
          <form action={updateUserName} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={profile.id} />
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-ouc-text">
                Full Name <span className="ml-0.5 text-red-600">*</span>
              </span>
              <input
                name="full_name"
                type="text"
                required
                defaultValue={profile.full_name}
                className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-ouc-text">Phone</span>
              <input
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ''}
                placeholder="(optional)"
                className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
              />
            </label>
            <div className="flex justify-end border-t border-ouc-border pt-4">
              <button
                type="submit"
                className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
              >
                Save Profile
              </button>
            </div>
          </form>
        </section>

        {/* Email — separate form so it's clear this is privileged */}
        <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm">
          <h2 className="mb-1 text-[14px] font-bold text-ouc-primary">Email Address</h2>
          <p className="mb-4 text-[12px] text-ouc-text-muted">
            This updates the sign-in email directly — no confirmation is sent.
          </p>
          <form action={updateUserEmail} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={profile.id} />
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-ouc-text">
                Email <span className="ml-0.5 text-red-600">*</span>
              </span>
              <input
                name="email"
                type="email"
                required
                defaultValue={profile.email}
                className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
              />
            </label>
            <div className="flex justify-end border-t border-ouc-border pt-4">
              <button
                type="submit"
                className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
              >
                Update Email
              </button>
            </div>
          </form>
        </section>

        <div className="text-right">
          <Link
            href="/admin/users"
            className="text-[13px] text-ouc-accent hover:underline"
          >
            ← Back to Users
          </Link>
        </div>
      </div>
    </div>
  );
}
