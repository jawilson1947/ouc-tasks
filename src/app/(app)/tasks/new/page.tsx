/**
 * /tasks/new — create a new task. Loads dropdown options server-side and
 * passes them to the shared TaskForm component.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TaskForm } from '@/components/TaskForm';
import { createTask } from '../actions';

export const metadata = { title: 'New Task — OUC Infrastructure Tasks' };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  // Authorization: redirect viewers / unauth back to the list.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!['admin', 'editor'].includes(profile?.role ?? '')) {
    redirect('/tasks?error=Admin+or+editor+role+required');
  }

  const [
    { data: categories },
    { data: locations },
    { data: contractors },
    { data: users },
  ] = await Promise.all([
    supabase.from('category').select('id, name').order('sort_order'),
    supabase.from('location').select('id, name').order('sort_order'),
    supabase.from('contractor').select('id, business_name, active').order('business_name'),
    supabase
      .from('user_profile')
      .select('id, full_name, role, active')
      .in('role', ['admin', 'editor'])
      .order('full_name'),
  ]);

  return (
    <div>
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/tasks" className="hover:text-ouc-primary">All Tasks</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>New</span>
      </div>
      <h1 className="mb-5 text-2xl font-bold text-ouc-primary">New Task</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}

      <TaskForm
        action={createTask}
        categories={categories ?? []}
        locations={locations ?? []}
        contractors={contractors ?? []}
        users={users ?? []}
        submitLabel="Create task"
      />
    </div>
  );
}
