'use client';

/**
 * TaskReceiptsCard — full receipt management for the task detail page.
 * Handles: list, view (lightbox), upload (slide-over), delete.
 */
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { deleteReceipt } from '@/app/(app)/tasks/receipt-actions';

export type Receipt = {
  id: string;
  filename: string;
  vendor: string | null;
  receipt_amount: number | string | null;
  receipt_date: string | null;
  caption: string | null;
  storage_path: string;
  content_type: string | null;
  uploaded_at: string;
};

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_MB = 10;

function fmtUSD(n: number | string | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(n));
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const s = iso.includes('T') ? iso : iso + 'T00:00:00';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function Lightbox({ url, contentType, filename, onClose }: {
  url: string; contentType: string | null; filename: string; onClose: () => void;
}) {
  const isPdf = contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] max-w-[92vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ouc-border px-4 py-3">
          <span className="max-w-[280px] truncate text-[13px] font-semibold text-ouc-text">{filename}</span>
          <button
            onClick={onClose}
            className="ml-4 flex h-7 w-7 items-center justify-center rounded-full text-ouc-text-muted hover:bg-ouc-surface hover:text-ouc-text"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="overflow-auto p-4">
          {isPdf ? (
            <div className="flex flex-col items-center gap-4 px-8 py-10">
              <div className="text-6xl">📄</div>
              <p className="text-[13px] text-ouc-text-muted">{filename}</p>
              <a
                href={url} target="_blank" rel="noopener noreferrer"
                className="rounded-lg bg-ouc-primary px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-ouc-primary-hover"
              >
                Open PDF ↗
              </a>
            </div>
          ) : (
            <img src={url} alt={filename} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload slide-over panel
// ---------------------------------------------------------------------------
function UploadPanel({ taskId, legacyId, onClose, onSuccess }: {
  taskId: string; legacyId: number; onClose: () => void; onSuccess: () => void;
}) {
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [vendor, setVendor]     = useState('');
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [caption, setCaption]   = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) { setError(`Type "${f.type}" not allowed. Use JPEG, PNG, WebP, or PDF.`); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`File exceeds ${MAX_MB} MB.`); return; }
    setError(null);
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0] ?? null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!amount || isNaN(parseFloat(amount))) { setError('Amount is required.'); return; }
    setUploading(true); setError(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('task_id', taskId);
    fd.append('vendor', vendor);
    fd.append('receipt_amount', amount);
    fd.append('receipt_date', date);
    fd.append('caption', caption);

    try {
      const res  = await fetch('/api/receipts/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Upload failed.'); setUploading(false); return; }
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1400);
    } catch {
      setError('Network error. Please try again.');
      setUploading(false);
    }
  }

  const fieldCls = 'w-full rounded-lg border border-ouc-border bg-white px-3 py-2 text-[13px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20';
  const labelCls = 'mb-1 block text-[11.5px] font-semibold text-ouc-text-muted';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ouc-border px-5 py-4">
          <h2 className="text-[15px] font-bold text-ouc-primary">Upload Receipt</h2>
          <button
            type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ouc-text-muted hover:bg-ouc-surface"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {done ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
              <p className="font-semibold text-ouc-text">Receipt uploaded!</p>
            </div>
          ) : (
            <form id="receipt-upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !file && fileRef.current?.click()}
                className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                  dragOver ? 'border-ouc-accent bg-ouc-accent/5' : file ? 'border-green-400 bg-green-50' : 'border-ouc-border hover:border-ouc-accent/50'
                }`}
              >
                <input ref={fileRef} type="file" accept={ALLOWED.join(',')} className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

                {file ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-4">
                    {preview ? (
                      <img src={preview} alt="preview" className="h-20 w-20 rounded-lg object-cover shadow" />
                    ) : (
                      <div className="text-4xl">📄</div>
                    )}
                    <p className="max-w-full truncate text-center text-[12.5px] font-semibold text-ouc-text">{file.name}</p>
                    <p className="text-[11px] text-ouc-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      className="text-[11.5px] text-ouc-text-muted underline hover:text-red-600">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
                    <div className="text-3xl">📎</div>
                    <p className="text-[13px] font-medium text-ouc-text">Drop file here or <span className="text-ouc-accent underline">browse</span></p>
                    <p className="text-[11px] text-ouc-text-muted">JPEG, PNG, WebP, PDF · max {MAX_MB} MB</p>
                  </div>
                )}
              </div>

              {/* Metadata fields */}
              <div>
                <label className={labelCls}>Amount ($) <span className="text-red-500">*</span></label>
                <input id="receipt-amount" type="number" min="0" step="0.01" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className={fieldCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Vendor / Store</label>
                  <input id="receipt-vendor" type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Home Depot" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Receipt Date</label>
                  <input id="receipt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes / Caption</label>
                <input id="receipt-caption" type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Rocker switch for basketball net" className={fieldCls} />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="border-t border-ouc-border px-5 py-4">
            <button form="receipt-upload-form" type="submit" disabled={uploading || !file}
              className="w-full cursor-pointer rounded-lg bg-ouc-primary py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-ouc-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload Receipt'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------
export function TaskReceiptsCard({
  receipts,
  taskId,
  legacyId,
}: {
  receipts: Receipt[];
  taskId: string;
  legacyId: number;
}) {
  const router = useRouter();
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [lightbox, setLightbox]         = useState<{ url: string; contentType: string | null; filename: string } | null>(null);
  const [loadingId, setLoadingId]       = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const total = receipts.reduce((s, r) => s + Number(r.receipt_amount ?? 0), 0);

  async function handleView(r: Receipt) {
    setLoadingId(r.id);
    try {
      const res = await fetch(`/api/receipts/signed-url?path=${encodeURIComponent(r.storage_path)}`);
      const { url, error } = await res.json();
      if (error || !url) { alert('Could not load receipt.'); return; }
      setLightbox({ url, contentType: r.content_type, filename: r.filename });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(r: Receipt) {
    if (!confirm(`Delete receipt "${r.filename}"? This cannot be undone.`)) return;
    setDeletingId(r.id);
    try {
      await deleteReceipt(r.id, legacyId);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Card */}
      <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ouc-primary">
            Receipts
            {receipts.length > 0 && (
              <span className="ml-2 rounded-full bg-ouc-surface px-2 py-0.5 text-[10px] font-bold text-ouc-text-muted normal-case tracking-normal">
                {receipts.length}
              </span>
            )}
          </h2>
          {receipts.length > 0 && (
            <span className="text-[12px] font-semibold tabular-nums text-ouc-text-muted">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(total)}
            </span>
          )}
        </div>

        {receipts.length === 0 ? (
          <p className="mb-3 text-[13px] text-ouc-text-muted">No receipts yet.</p>
        ) : (
          <div className="mb-3 flex flex-col divide-y divide-ouc-border">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-start gap-3 py-2.5 hover:bg-ouc-surface">
                {/* Icon */}
                <div className="mt-0.5 shrink-0 text-lg">
                  {r.content_type === 'application/pdf' ? '📄' : '🧾'}
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold tabular-nums text-ouc-primary">
                      {fmtUSD(r.receipt_amount)}
                    </span>
                    {r.vendor && <span className="text-[12px] text-ouc-text-muted">{r.vendor}</span>}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ouc-text-muted">
                    {fmtDate(r.receipt_date ?? r.uploaded_at)}
                    {r.caption && ` · ${r.caption}`}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    id={`view-receipt-${r.id}`}
                    onClick={() => handleView(r)}
                    disabled={loadingId === r.id}
                    className="rounded border border-ouc-border bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ouc-text hover:bg-ouc-surface disabled:opacity-50"
                  >
                    {loadingId === r.id ? '…' : 'View'}
                  </button>
                  <button
                    type="button"
                    id={`delete-receipt-${r.id}`}
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === r.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        <button
          type="button"
          id="upload-receipt-btn"
          onClick={() => setUploaderOpen(true)}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-ouc-border px-3 py-2 text-[12.5px] text-ouc-text-muted transition-colors hover:border-ouc-accent hover:text-ouc-accent"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
          </svg>
          Upload receipt
        </button>
      </section>

      {/* Upload slide-over */}
      {uploaderOpen && (
        <UploadPanel
          taskId={taskId}
          legacyId={legacyId}
          onClose={() => setUploaderOpen(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          contentType={lightbox.contentType}
          filename={lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
