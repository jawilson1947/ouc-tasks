/**
 * /tasks/[legacyId]/edit — edit or delete an existing task.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TaskForm } from '@/components/TaskForm';
import { updateTask, deleteTask } from '../../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legacyId: string }>;
}) {
  const { legacyId } = await params;
  return { title: `Edit Task #${legacyId} — OUC Infrastructure Tasks` };
}

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ legacyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { legacyId } = await params;
  const sp = await searchParams;
  const n = Number(legacyId);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();

  // Auth check.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('user_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!['admin', 'editor'].includes(profile?.role ?? '')) {
    redirect(`/tasks/${legacyId}?error=Admin+or+editor+role+required`);
  }

  const { data: task, error } = await supabase
    .from('task')
    .select('id, legacy_id, title, description, priority, status, category_id, location_id, contractor_id, assignee_id, due_date, notes, created_by')
    .eq('legacy_id', n)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load task: {error.message}
      </div>
    );
  }
  if (!task) notFound();

  // Editor can only edit own tasks. Admin can edit any.
  if (profile?.role === 'editor' && task.created_by !== user.id) {
    redirect(`/tasks/${legacyId}?error=Editors+can+only+edit+tasks+they+created`);
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
        <Link href={`/tasks/${legacyId}`} className="hover:text-ouc-primary">
          Task #{legacyId}
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Edit</span>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-ouc-primary">
          Edit Task #{task.legacy_id}
        </h1>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
            className="cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50"
          >
            Delete task
          </button>
        </form>
      </div>

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}

      <TaskForm
        action={updateTask}
        defaults={task}
        categories={categories ?? []}
        locations={locations ?? []}
        contractors={contractors ?? []}
        users={users ?? []}
        submitLabel="Save changes"
        isEdit
        cancelHref={`/tasks/${legacyId}`}
      />
    </div>
  );
}
