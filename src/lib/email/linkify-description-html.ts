/**
 * linkify-description-html — email/HTML twin of linkify-description.tsx.
 *
 * Same rule: if the description starts with `http://` or `https://`
 * (case-insensitive), peel the URL prefix (everything up to the first
 * whitespace) and render it as an inline <a>. Remainder stays as plain
 * (HTML-escaped) text.
 *
 * Inline styles match the existing email link convention used throughout
 * src/lib/email/templates/* — body copy is `#1F2830` and accents/links
 * use `#333F48`. This is the text-link variant (not the button variant
 * which has a filled background).
 *
 * Returns an HTML-safe string. The whole description is escaped before
 * linkification; the produced <a> tag uses an escaped href and text body.
 */
import { escapeHtml } from './templates/shared';

const URL_PREFIX_RE = /^(https?:\/\/\S+)/i;

/** Default inline style for inline links inside email body text. */
const DEFAULT_LINK_STYLE =
  'color:#333F48;text-decoration:underline;';

export function linkifyDescriptionHtml(
  description: string | null | undefined,
  opts: { linkStyle?: string } = {},
): string {
  if (!description) return '';

  const match = description.match(URL_PREFIX_RE);
  if (!match) return escapeHtml(description);

  const url = match[1];
  const rest = description.slice(url.length);
  const style = opts.linkStyle ?? DEFAULT_LINK_STYLE;

  // href + visible text both reflect the original URL (case preserved).
  return `<a href="${escapeHtml(url)}" style="${style}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    url,
  )}</a>${escapeHtml(rest)}`;
}
