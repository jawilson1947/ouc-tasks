/**
 * Display formatters used across all app pages.
 * Lightweight, no dependencies — pure functions only.
 *
 * Time-zone policy: every date/time helper in this file routes through the
 * `APP_TIMEZONE` constant. To change the app-wide display timezone, edit the
 * NEXT_PUBLIC_APP_TIMEZONE env var (or set a different IANA name as the
 * fallback) and redeploy — no other file needs to change.
 *
 * Because NEXT_PUBLIC_APP_TIMEZONE is inlined at build time, both server
 * components and client components format dates in the same zone, even when
 * the visitor's machine is in a different zone.
 */

export const APP_TIMEZONE: string =
  process.env.NEXT_PUBLIC_APP_TIMEZONE ?? 'America/Chicago';

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
};

const DEFAULT_DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

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

/**
 * Format a date string as e.g. "May 14" (default opts) in APP_TIMEZONE.
 *
 * Accepts either a date-only string (YYYY-MM-DD) or a full timestamp. For
 * date-only inputs we append T00:00:00 so the parser treats the value as
 * local-midnight rather than UTC, which avoids the well-known "off by one
 * day" bug when the viewer's zone is west of UTC.
 *
 * Returns "—" for null/empty/invalid.
 */
export function fmtDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS,
): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, ...opts });
}

/** Format a date as "May 7, 2026" in APP_TIMEZONE. */
export function fmtDateLong(iso: string | null | undefined): string {
  return fmtDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format a date as "May 7, 2026" (long month) in APP_TIMEZONE. */
export function fmtDateLonger(iso: string | null | undefined): string {
  return fmtDate(iso, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Format a date as "Wednesday, May 7, 2026" in APP_TIMEZONE. */
export function fmtDateWeekday(iso: string | null | undefined): string {
  return fmtDate(iso, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a full timestamp ("May 7, 2026, 3:42 PM") in APP_TIMEZONE.
 * Returns '' for null/empty so callers can render a placeholder of their
 * choice (some pages use "—", others use plain blank).
 */
export function fmtTimestamp(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTS,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { timeZone: APP_TIMEZONE, ...opts });
}

/** Today's date in APP_TIMEZONE, formatted as "Wednesday, May 20, 2026". */
export function fmtToday(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
