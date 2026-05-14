'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

const SORT_OPTIONS = [
  { value: 'legacy_id', label: 'Task #' },
  { value: 'priority',  label: 'Priority' },
  { value: 'status',    label: 'Status' },
  { value: 'location',  label: 'Location' },
  { value: 'category',  label: 'Category' },
  { value: 'cost',      label: 'Total Cost' },
] as const;

export default function PrintControlsClient({
  sort = 'legacy_id',
  dir = 'asc',
}: {
  sort?: string;
  dir?: string;
}) {
  const router = useRouter();

  const navigate = useCallback((newSort: string, newDir: string) => {
    const params = new URLSearchParams({ preview: '1', sort: newSort, dir: newDir });
    router.replace(`/reports/print?${params.toString()}`);
  }, [router]);

  return (
    <div className="no-print mt-8 flex flex-wrap items-center gap-4 border-t border-gray-200 pt-6">
      {/* Sort controls */}
      <div className="flex items-center gap-2 text-[13px] text-gray-600">
        <span className="font-semibold text-gray-700">Sort by:</span>
        <select
          value={sort}
          onChange={(e) => navigate(e.target.value, dir)}
          className="rounded border border-gray-300 px-2 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={dir}
          onChange={(e) => navigate(sort, e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-gray-700"
        >
          Print / Save as PDF
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}
