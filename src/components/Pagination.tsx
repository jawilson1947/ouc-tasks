/**
 * Pagination — shared bar used by /tasks, /tasks/mine, and /approvals.
 *
 * Server-safe (no client hooks). The caller decides how to build per-page
 * URLs via the `hrefForPage` callback so each listing can preserve its own
 * filter state (search, status, priority, category, etc.).
 *
 * Two helpers are exported alongside the component:
 *   - buildPageHref(base, page, otherParams) — convenience URL builder for
 *     listings whose only URL param is `page`.
 *   - pageNumbers(current, total) — decides which numbers + ellipses to
 *     render in the bar so the layout stays a predictable width.
 */
import Link from 'next/link';

/**
 * Build a /path?... href that points at a specific page. `page=1` is omitted
 * so the canonical URL stays clean.
 *
 * Used directly by callers whose only state is the page param. Callers with
 * additional state (filters, search) can pass it via `otherParams`.
 */
export function buildPageHref(
  base: string,
  targetPage: number,
  otherParams: Record<string, string | undefined> = {},
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(otherParams)) {
    if (v) qs.set(k, v);
  }
  if (targetPage > 1) qs.set('page', String(targetPage));
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * Decide which page numbers to render in the bar.
 * For ≤7 total pages, render them all. For more, render
 *   first, …, current-1, current, current+1, …, last
 * so the bar stays a fixed width regardless of how many pages there are.
 */
export function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  const pages = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  for (let i = 0; i < pages.length; i++) {
    result.push(pages[i]);
    if (i < pages.length - 1 && pages[i + 1] - pages[i] > 1) {
      result.push('…');
    }
  }
  return result;
}

export function Pagination({
  currentPage,
  totalPages,
  hrefForPage,
}: {
  currentPage: number;
  totalPages: number;
  /** Returns the URL for a given page number. Lets each listing keep its own filter state. */
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const navBtn =
    'rounded-md border border-ouc-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ouc-text hover:bg-ouc-surface-alt';
  const navBtnDisabled =
    'rounded-md border border-ouc-border bg-ouc-surface px-2.5 py-1 text-[12.5px] font-medium text-ouc-text-muted opacity-50 cursor-not-allowed';

  return (
    <nav
      className="mt-4 flex items-center justify-center gap-1.5"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={hrefForPage(currentPage - 1)}
          className={navBtn}
          aria-label="Previous page"
        >
          ‹ Prev
        </Link>
      ) : (
        <span className={navBtnDisabled} aria-hidden>‹ Prev</span>
      )}

      {pageNumbers(currentPage, totalPages).map((n, i) =>
        n === '…' ? (
          <span
            key={`gap-${i}`}
            className="px-1.5 text-[12.5px] text-ouc-text-muted"
            aria-hidden
          >
            …
          </span>
        ) : n === currentPage ? (
          <span
            key={n}
            aria-current="page"
            className="rounded-md border border-ouc-primary bg-ouc-primary px-2.5 py-1 text-[12.5px] font-semibold text-white"
          >
            {n}
          </span>
        ) : (
          <Link key={n} href={hrefForPage(n)} className={navBtn}>
            {n}
          </Link>
        ),
      )}

      {hasNext ? (
        <Link
          href={hrefForPage(currentPage + 1)}
          className={navBtn}
          aria-label="Next page"
        >
          Next ›
        </Link>
      ) : (
        <span className={navBtnDisabled} aria-hidden>Next ›</span>
      )}
    </nav>
  );
}
