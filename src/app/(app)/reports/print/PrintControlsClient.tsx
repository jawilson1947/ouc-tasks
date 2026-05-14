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

const STATUS_OPTIONS = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'done',        label: 'Done' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: '5',   label: 'P5 — Highest' },
  { value: '4',   label: 'P4' },
  { value: '3',   label: 'P3' },
  { value: '2',   label: 'P2' },
  { value: '1',   label: 'P1 — Lowest' },
] as const;

type SelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
};

function FilterSelect({ label, value, onChange, children }: SelectProps) {
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-gray-600">
      <span className="font-semibold text-gray-700 whitespace-nowrap">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
      >
        {children}
      </select>
    </div>
  );
}

export default function PrintControlsClient({
  sort = 'legacy_id',
  dir = 'asc',
  filterStatus = 'all',
  filterPriority = 'all',
  filterCategory = 'all',
  filterLocation = 'all',
  categories = [],
  locations = [],
}: {
  sort?: string;
  dir?: string;
  filterStatus?: string;
  filterPriority?: string;
  filterCategory?: string;
  filterLocation?: string;
  categories?: { id: number; name: string }[];
  locations?: { id: number; name: string }[];
}) {
  const router = useRouter();

  const navigate = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams({
      preview: '1',
      sort,
      dir,
      status:   filterStatus,
      priority: filterPriority,
      category: filterCategory,
      location: filterLocation,
      ...overrides,
    });
    // Drop "all" params to keep URLs clean
    ['status', 'priority', 'category', 'location'].forEach((key) => {
      if (params.get(key) === 'all') params.delete(key);
    });
    router.replace(`/reports/print?${params.toString()}`);
  }, [router, sort, dir, filterStatus, filterPriority, filterCategory, filterLocation]);

  const hasFilters = filterStatus !== 'all' || filterPriority !== 'all' ||
                     filterCategory !== 'all' || filterLocation !== 'all';

  return (
    <div className="no-print mt-8 border-t border-gray-200 pt-6">
      {/* Filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Filters</span>

        <FilterSelect label="Status" value={filterStatus} onChange={(v) => navigate({ status: v })}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FilterSelect>

        <FilterSelect label="Priority" value={filterPriority} onChange={(v) => navigate({ priority: v })}>
          {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FilterSelect>

        <FilterSelect label="Category" value={filterCategory} onChange={(v) => navigate({ category: v })}>
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </FilterSelect>

        <FilterSelect label="Location" value={filterLocation} onChange={(v) => navigate({ location: v })}>
          <option value="all">All Locations</option>
          {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </FilterSelect>

        {hasFilters && (
          <button
            type="button"
            onClick={() => navigate({ status: 'all', priority: 'all', category: 'all', location: 'all' })}
            className="rounded border border-gray-300 px-2.5 py-1.5 text-[12px] text-gray-500 hover:bg-gray-100"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Sort + action row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Sort</span>

        <FilterSelect label="by" value={sort} onChange={(v) => navigate({ sort: v })}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FilterSelect>

        <FilterSelect label="" value={dir} onChange={(v) => navigate({ dir: v })}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </FilterSelect>

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
    </div>
  );
}
