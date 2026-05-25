/**
 * linkify-description — render-time hyperlinking for task descriptions.
 *
 * Rule (kept intentionally narrow):
 *   If a description starts with `http://` or `https://` (case-insensitive),
 *   the URL runs until the first whitespace character; that prefix becomes
 *   a clickable <a>, and the remainder is rendered as plain text.
 *
 *   Examples:
 *     "https://example.com — see attached doc"
 *       -> <a>https://example.com</a> — see attached doc
 *     "Plain text without a URL"
 *       -> "Plain text without a URL"  (unchanged)
 *     "HTTPS://Foo.test/path"
 *       -> <a href="HTTPS://Foo.test/path">HTTPS://Foo.test/path</a>
 *
 * The original `task.description` string in the database is never modified;
 * this helper is purely a render-time transformation. The task edit textarea
 * (TaskForm) is intentionally NOT wired through this helper — users need to
 * be able to edit the URL as plain text.
 *
 * Click behavior is handled in DescriptionLink (a client component), which
 * opens the URL in a ~1100×800 popup window via window.open(...). The
 * target="_blank" attribute remains as a fallback for middle-click / JS-off /
 * popup-blocked situations.
 *
 * Sister helper for emails: src/lib/email/linkify-description-html.ts.
 */
import type { ReactNode } from 'react';
import { DescriptionLink } from './DescriptionLink';

/** RegExp used both to detect and to peel the URL off the front of the string. */
const URL_PREFIX_RE = /^(https?:\/\/\S+)/i;

/**
 * Render a description with a leading http(s) URL turned into a hyperlink.
 *
 * Returns `null` for empty/whitespace-only input so callers can guard with
 * `{linkifyDescription(d) ?? <em>No description</em>}` if they want a
 * fallback. If the description doesn't start with a URL scheme, the original
 * string is returned (as a plain string, not wrapped in any element).
 *
 * Pass `linkClassName` to override the default `text-ouc-accent hover:underline`
 * styling — useful for the print report where a different look (or no
 * `target="_blank"`) may be wanted.
 */
export function linkifyDescription(
  description: string | null | undefined,
  opts: {
    linkClassName?: string;
    /** If false, omit target="_blank" / rel — handy for print views. */
    openInNewTab?: boolean;
  } = {},
): ReactNode {
  if (!description) return null;
  const match = description.match(URL_PREFIX_RE);
  if (!match) return description;

  const url = match[1];
  const rest = description.slice(url.length);

  const className = opts.linkClassName ?? 'text-ouc-accent hover:underline';
  const openInNewTab = opts.openInNewTab ?? true;

  return (
    <>
      <DescriptionLink url={url} className={className} openInNewTab={openInNewTab} />
      {rest}
    </>
  );
}
