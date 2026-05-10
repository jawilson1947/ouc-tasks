'use client';

/**
 * ReportsExportBar — client component that powers all 5 export options
 * on the Reports page.
 *
 * CSV options hit the Route Handler and trigger a file download.
 * PDF options use window.print() (with orientation set via a data attribute)
 * or open /reports/print in a new tab for the formal Word-doc-style report.
 */
import { useState, useRef, useEffect } from 'react';

type CsvType = 'tasks' | 'summary';
type PdfType = 'landscape' | 'portrait' | 'formal';

const CSV_OPTIONS: { value: CsvType; label: string; hint: string }[] = [
  { value: 'tasks',   label: 'Full Task List',   hint: 'All tasks with every column — best for Excel' },
  { value: 'summary', label: 'Report Summary',   hint: 'Aggregated tables — 4 sections in one file'  },
];

const PDF_OPTIONS: { value: PdfType; label: string; hint: string }[] = [
  { value: 'landscape', label: 'Summary — Landscape', hint: 'Report cards, 2-per-row'                          },
  { value: 'portrait',  label: 'Summary — Portrait',  hint: 'Report cards, stacked vertically'                 },
  { value: 'formal',    label: 'Formal Task Report',  hint: 'Word-doc style — OUC logo, full task table'       },
];

// ---------------------------------------------------------------------------
// Reusable dropdown button
// ---------------------------------------------------------------------------
function ExportDropdown<T extends string>({
  icon,
  label,
  options,
  defaultValue,
  accent,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  options: { value: T; label: string; hint: string }[];
  defaultValue: T;
  accent: string;
  onSelect: (value: T) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [active, setActive] = useState<T>(defaultValue);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function choose(v: T) {
    setActive(v);
    setOpen(false);
    onSelect(v);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex overflow-hidden rounded-lg border border-ouc-border shadow-sm">
        {/* Main action button */}
        <button
          type="button"
          onClick={() => onSelect(active)}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-colors ${accent}`}
        >
          {icon}
          {label}
        </button>
        {/* Chevron / dropdown toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="More export options"
          className={`border-l border-ouc-border px-2 transition-colors ${accent}`}
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z" />
          </svg>
        </button>
      </div>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-ouc-border bg-white shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-ouc-surface ${
                active === opt.value ? 'bg-ouc-surface' : ''
              }`}
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ouc-text">
                {active === opt.value && (
                  <span className="text-ouc-accent">✓</span>
                )}
                {active !== opt.value && <span className="w-4" />}
                {opt.label}
              </div>
              <div className="pl-6 text-[11.5px] text-ouc-text-muted">{opt.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function ReportsExportBar() {
  function handleCSV(type: CsvType) {
    // Trigger file download by navigating to the route handler
    const a = document.createElement('a');
    a.href = `/api/reports/export?type=${type}`;
    a.click();
  }

  function handlePDF(type: PdfType) {
    if (type === 'formal') {
      window.open('/reports/print', '_blank', 'noopener,noreferrer');
      return;
    }
    // Set orientation on the root element — picked up by @media print CSS
    document.documentElement.dataset.printOrientation = type;
    window.print();
  }

  return (
    <div className="no-print flex items-center gap-2">
      <ExportDropdown<CsvType>
        icon={
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
          </svg>
        }
        label="Export CSV"
        options={CSV_OPTIONS}
        defaultValue="tasks"
        accent="bg-white text-ouc-text hover:bg-ouc-surface"
        onSelect={handleCSV}
      />

      <ExportDropdown<PdfType>
        icon={
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
            <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>
          </svg>
        }
        label="Export PDF"
        options={PDF_OPTIONS}
        defaultValue="landscape"
        accent="bg-ouc-primary text-white hover:bg-ouc-primary-hover"
        onSelect={handlePDF}
      />
    </div>
  );
}
