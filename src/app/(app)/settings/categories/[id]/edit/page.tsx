/**
 * Settings › Categories › [id] › Edit — edit an existing category.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DeleteButton } from '@/components/DeleteButton';
import { updateCategory, deleteCategory } from '../../actions';

export const metadata = { title: 'Edit Category — OUC Infrastructure Tasks' };

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id: idStr } = await params;
  const sp = await searchParams;
  const id = Number(idStr);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('category')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) notFound();

  const cat = data as { id: number; name: string };

  return (
    <div>
      <div className="mb-1 text-[12.5px] text-ouc-text-muted">
        <Link href="/settings/categories" className="hover:text-ouc-primary">
          Categories
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>Edit</span>
      </div>
      <h1 className="mb-5 text-2xl font-bold text-ouc-primary">Edit Category</h1>

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}
      {sp.saved && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Category saved.
        </div>
      )}

      <form
        action={updateCategory}
        className="max-w-lg rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm"
      >
        <input type="hidden" name="id" value={cat.id} />

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-ouc-text">
            Category Name <span className="ml-0.5 text-red-600">*</span>
          </span>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            defaultValue={cat.name}
            className="w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20"
          />
        </label>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-ouc-border pt-4">
          <Link
            href="/settings/categories"
            className="rounded-md border border-ouc-border bg-white px-4 py-2 text-[13px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
          >
            Cancel
          </Link>
          <button
            type="submit"
            id="submit-edit-category"
            className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            Save Changes
          </button>
        </div>
      </form>

      {/* Delete — must be outside the update form (no nested forms in HTML) */}
      <div className="mt-3 max-w-lg">
        <DeleteButton
          id={cat.id}
          label="Delete this category"
          confirmMessage={`Delete "${cat.name}"? This cannot be undone.`}
          action={deleteCategory}
        />
      </div>
    </div>
  );
}
