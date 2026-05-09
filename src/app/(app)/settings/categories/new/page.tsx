/**
 * Settings › Categories › New — create a new category.
 */
import Link from 'next/link';
import { createCategory } from '../actions';

export const metadata = { title: 'New Category — OUC Infrastructure Tasks' };

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <div className="mb-1 text-[12.5px] text-ouc-text-muted">
        <Link href="/settings/categories" className="hover:text-ouc-primary">
          Categories
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>New</span>
      </div>
      <h1 className="mb-5 text-2xl font-bold text-ouc-primary">New Category</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}

      <form
        action={createCategory}
        className="max-w-lg rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-ouc-text">
            Category Name <span className="ml-0.5 text-red-600">*</span>
          </span>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            autoFocus
            placeholder="e.g. Surveillance"
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
            id="submit-new-category"
            className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            Create Category
          </button>
        </div>
      </form>
    </div>
  );
}
