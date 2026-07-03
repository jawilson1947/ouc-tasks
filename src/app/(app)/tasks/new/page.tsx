/**
 * /tasks/new — create a new task. Loads dropdown options server-side and
 * passes them to the shared TaskForm component.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { TaskForm } from '@/components/TaskForm';
import { createTask } from '../actions';

export const metadata = { title: 'New Task — OUC Infrastructure Tasks' };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Authorization: redirect viewers / unauth back to the list.
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!['admin', 'editor', 'approver'].includes(user.role)) {
    redirect('/tasks?error=Admin%2C+editor%2C+or+approver+role+required');
  }

  const [categories, locations, contractorRows, userRows] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.contractor.findMany({
      select: { id: true, businessName: true, active: true },
      orderBy: { businessName: 'asc' },
    }),
    prisma.userProfile.findMany({
      where: { role: { in: ['admin', 'editor', 'approver'] } },
      select: { id: true, fullName: true, role: true, active: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  // TaskForm expects the old snake_case column names.
  const contractors = contractorRows.map((c) => ({
    id: c.id,
    business_name: c.businessName,
    active: c.active,
  }));
  const users = userRows.map((u) => ({
    id: u.id,
    full_name: u.fullName,
    role: u.role,
    active: u.active,
  }));

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
        categories={categories}
        locations={locations}
        contractors={contractors}
        users={users}
        submitLabel="Create task"
      />
    </div>
  );
}
