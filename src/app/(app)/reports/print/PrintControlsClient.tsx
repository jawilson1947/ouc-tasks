'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUSES: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked'     },
  { value: 'done',        label: 'Done'        },
  { value: 'approved',    label: 'Approved'    },
];

const SORT_OPTIONS = [
  { value: 'priority',  label: 'Priority' },
  { value: 'legacy_id', label: 'Task #' },
  { value: 'status',    label: 'Status' },
  { value: 'location',  label: 'Location' },
  { value: 'category',  label: 'Category' },
  { value: 'cost',      label: 'Total Cost' },
] as const;

export default function PrintControlsClient({
  activeStatuses,
  isPreview,
  reportReady,
  sort = 'priority',
  dir = 'desc',
}: {
  activeStatuses: string[];
  isPreview: boolean;
  reportReady: boolean;
  sort?: string;
  dir?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(activeStatuses[0] ?? '');

  function buildUrl(overrides: { status?: string; sort?: string; dir?: string }) {
    const params = new URLSearchParams();
    if (isPreview) params.set('preview', '1');
    const s = overrides.status  ?? selected;
    const o = overrides.sort    ?? sort;
    const d = overrides.dir     ?? dir;
    if (s) params.set('status', s);
    params.set('sort', o);
    params.set('dir', d);
    return `/reports/print?${params.toString()}`;
  }

  function generate() {
    router.push(buildUrl({}));
  }

  function clearFilter() {
    setSelected('');
    router.push(`/reports/print${isPreview ? '?preview=1' : ''}`);
  }

  const canGenerate = selected !== '';

  return (
    <div className="no-print mb-6">
      <h1 className="mb-3 text-[20px] font-bold text-gray-900">Print Formal Task Report</h1>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">

        {/* Status filter */}
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
          Filter by Status
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <label
              key={s.value}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors select-none ${
                selected === s.value
                  ? 'border-gray-800 bg-gray-800 text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="status-filter"
                className="sr-only"
                value={s.value}
                checked={selected === s.value}
                onChange={() => setSelected(s.value)}
              />
              {s.label}
            </label>
          ))}
          {selected !== '' && (
            <button
              type="button"
              onClick={clearFilter}
              className="text-[12px] text-gray-400 underline hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort controls — only shown once a status is selected */}
        {(canGenerate || reportReady) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-500">Sort by</span>
            <select
              value={sort}
              onChange={(e) => router.push(buildUrl({ sort: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={dir}
              onChange={(e) => router.push(buildUrl({ dir: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="rounded-lg bg-gray-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate Report
          </button>

          {reportReady && (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-100"
            >
              🖨 Print / Save as PDF
            </button>
          )}

          {!canGenerate && (
            <span className="text-[12px] text-gray-400">Select a status to generate the report.</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11.5px] italic text-gray-400">Select a status filter before printing</p>
    </div>
  );
}
