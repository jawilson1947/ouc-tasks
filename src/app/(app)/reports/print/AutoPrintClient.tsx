'use client';

import { useEffect } from 'react';

/**
 * Triggers window.print() once after a short delay.
 * Suppressed when preview=true (i.e. URL has ?preview=1).
 */
export default function AutoPrintClient({ preview }: { preview: boolean }) {
  useEffect(() => {
    if (preview) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [preview]);

  return null;
}
