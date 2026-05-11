'use client';

export default function PrintControlsClient() {
  return (
    <div className="no-print mt-8 flex items-center gap-4 border-t border-gray-200 pt-6">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-gray-700"
      >
        🖨 Print / Save as PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="rounded-lg border border-gray-300 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-100"
      >
        Close
      </button>
      <span className="text-[12px] text-gray-400">
        Tip: add <code>?preview=1</code> to the URL to suppress auto-print
      </span>
    </div>
  );
}
