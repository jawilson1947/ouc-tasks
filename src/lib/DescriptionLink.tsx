/**
 * DescriptionLink — client-side anchor used by `linkifyDescription`.
 *
 * Split into its own file (with `'use client'`) because the React helper is
 * called from Server Components (e.g. the task detail page), and `onClick`
 * handlers can only live in client components.
 *
 * Click behavior:
 *   Plain left-click  -> open in a popup browser window (~1100×800) via
 *                        window.open(..., 'popup,noopener,noreferrer,...').
 *                        If the popup is allowed, we preventDefault to suppress
 *                        the default new-tab navigation.
 *   Modified click    -> (cmd/ctrl/shift/alt or middle-click) we get out of
 *                        the way and let the browser do its usual thing
 *                        (e.g. open in a new background tab).
 *   Popup blocked / JS off
 *                     -> falls through to the anchor's `target="_blank"
 *                        rel="noopener noreferrer"`, so users still get a
 *                        functional link.
 */
'use client';

import type { MouseEventHandler } from 'react';

export function DescriptionLink({
  url,
  className,
  openInNewTab,
}: {
  url: string;
  className: string;
  openInNewTab: boolean;
}) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    // Honor modifier keys / middle-click — don't hijack those.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    const popup = window.open(
      url,
      '_blank',
      'popup,noopener,noreferrer,width=1100,height=800',
    );
    // If the popup actually opened, suppress the default navigation.
    // If it was blocked (popup === null), let the anchor's target="_blank"
    // fallback take over.
    if (popup) {
      e.preventDefault();
    }
  };

  return (
    <a
      href={url}
      className={className}
      onClick={handleClick}
      {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {url}
    </a>
  );
}
