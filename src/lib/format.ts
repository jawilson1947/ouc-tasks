/**
 * Display formatters used across all app pages.
 * Lightweight, no dependencies — pure functions only.
 */

export function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtUSDCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format a YYYY-MM-DD date string as e.g. "May 14". Returns "—" for null/empty. */
export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!iso) return '—';
  // Add T00:00:00 so the parser treats it as local-midnight, not UTC (which can shift dates by one day).
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', opts);
}

/** Format a timestamp as "May 7, 2026". */
export function fmtDateLong(iso: string | null | undefined): string {
  return fmtDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}
