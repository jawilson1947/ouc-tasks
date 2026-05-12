import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateProfile } from './actions';

export const metadata = { title: 'My Profile — OUC Infrastructure Tasks' };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profile')
    .select('full_name, email, role, phone')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');

  const ROLE_LABEL: Record<string, string> = {
    admin: 'Admin',
    staff: 'Staff',
    contractor: 'Contractor',
    viewer: 'Viewer',
  };

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-ouc-primary">My Profile</h1>

      {sp.error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700"
        >
          {sp.error}
        </div>
      )}
      {sp.saved && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Profile saved.
        </div>
      )}

      <form
        action={updateProfile}
        className="max-w-lg rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm"
      >
        <div className="flex flex-col gap-4">
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
            <span className="text-[12px] font-semibold text-ouc-text">Email</span>
            <input
              type="text"
              readOnly
              value={profile.email}
              className="w-full rounded-md border border-ouc-border bg-ouc-surface px-2.5 py-1.5 text-[13.5px] text-ouc-text-muted"
              title="Email cannot be changed here"
            />
            <span className="text-[11.5px] text-ouc-text-muted">
              To change your email, contact an admin.
            </span>
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

          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-ouc-text">Role</span>
            <span className="rounded-md border border-ouc-border bg-ouc-surface px-2.5 py-1.5 text-[13.5px] text-ouc-text-muted">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </span>
            <span className="text-[11.5px] text-ouc-text-muted">
              Role changes require an admin.
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end border-t border-ouc-border pt-4">
          <button
            type="submit"
            className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
