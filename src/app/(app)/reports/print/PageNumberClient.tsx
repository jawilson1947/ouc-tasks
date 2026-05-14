'use client';

import { useEffect } from 'react';

/**
 * Injects total-page count into every .page-total span before the
 * print dialog opens, using the beforeprint event.
 *
 * Individual page numbers come from a CSS counter on the fixed footer —
 * that works in Chrome and Firefox. Total pages require knowing the
 * final rendered height, so we calculate it here in JS.
 */
export default function PageNumberClient() {
  useEffect(() => {
    function beforePrint() {
      // A4/Letter portrait at 96 dpi ≈ 1056px per page. Use offsetHeight of
      // the printable content div to estimate total pages.
      const content = document.getElementById('print-content');
      if (!content) return;
      const pageHeightPx = 1056; // letter portrait at 96 dpi
      const totalPages = Math.max(1, Math.ceil(content.offsetHeight / pageHeightPx));
      document.querySelectorAll<HTMLElement>('.page-total').forEach((el) => {
        el.textContent = String(totalPages);
      });
    }

    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, []);

  return null;
}
