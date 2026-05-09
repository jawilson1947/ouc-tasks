/**
 * Settings › Categories — list all categories. Server Component.
 */
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { deleteCategory } from './actions';

export const metadata = { title: 'Categories — OUC Infrastructure Tasks' };

type Category = { id: number; name: string };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('category')
    .select('id, name')
    .order('name');

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load categories:</strong> {error.message}
      </div>
    );
  }

  const categories = (data ?? []) as Category[];

  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[12.5px] text-ouc-text-muted">
            <Link href="/settings/categories" className="hover:text-ouc-primary">
              Settings
            </Link>
            <span className="mx-1.5 opacity-50">›</span>
            <span>Categories</span>
          </div>
          <h1 className="text-2xl font-bold text-ouc-primary">Categories</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </div>
        </div>
        <Link
          href="/settings/categories/new"
          className="rounded-lg bg-ouc-primary px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-ouc-primary-hover"
        >
          + New Category
        </Link>
      </div>

      {/* Flash messages */}
      {params.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {params.error}
        </div>
      )}
      {params.created && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Category created.
        </div>
      )}
      {params.deleted && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Category deleted.
        </div>
      )}

      {/* Table */}
      {categories.length === 0 ? (
        <div className="rounded-[10px] border border-ouc-border bg-white px-6 py-10 text-center shadow-sm">
          <div className="mb-2 text-base font-semibold text-ouc-text">No categories yet</div>
          <p className="mx-auto mb-4 max-w-md text-[13.5px] text-ouc-text-muted">
            Add categories to classify tasks by type of work.
          </p>
          <Link
            href="/settings/categories/new"
            className="inline-block rounded-lg bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            + Add the first category
          </Link>
        </div>
      ) : (
        <div className="rounded-[10px] border border-ouc-border bg-white shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="w-12 border-b border-ouc-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
                  ID
                </th>
                <th className="border-b border-ouc-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
                  Name
                </th>
                <th className="border-b border-ouc-border px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-ouc-border last:border-b-0 hover:bg-ouc-surface"
                >
                  <td className="px-3 py-2.5 align-middle text-ouc-text-muted">{cat.id}</td>
                  <td className="px-3 py-2.5 align-middle font-medium text-ouc-text">
                    {cat.name}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/settings/categories/${cat.id}/edit`}
                        className="rounded border border-ouc-border bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ouc-text hover:bg-ouc-surface-alt"
                      >
                        Edit
                      </Link>
                      <form action={deleteCategory}>
                        <input type="hidden" name="id" value={cat.id} />
                        <button
                          type="submit"
                          id={`delete-category-${cat.id}`}
                          onClick={(e) => {
                            if (!confirm(`Delete "${cat.name}"? This cannot be undone.`))
                              e.preventDefault();
                          }}
                          className="cursor-pointer rounded border border-red-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
