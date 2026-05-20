'use client';

/**
 * TaskPhotosCard — historical name, now the unified Attachments card.
 * Renders both image attachments (type='photo') and PDF documents
 * (type='document'). The UI label is "Attachments"; the file/component
 * name is retained so existing imports keep working.
 *
 * Behaviour per type:
 *   - Images: thumbnail grid (signed URL), click → lightbox
 *   - PDFs:   file-icon tile,             click → open signed URL in new tab
 *
 * Upload accepts JPEG/PNG/WebP/PDF, max 50 MB. The backing API is
 * /api/photos/upload which branches storage path + attachment type by MIME.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { deletePhoto } from '@/app/(app)/tasks/photo-actions';
import { fmtDateLong } from '@/lib/format';

export type Photo = {
  id: string;
  filename: string;
  caption: string | null;
  storage_path: string;
  content_type: string | null;
  uploaded_at: string;
};

const IMAGE_TYPES   = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_TYPES     = ['application/pdf'];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOC_TYPES];
const MAX_MB = 50;

function isImage(ct: string | null | undefined): boolean {
  return !!ct && IMAGE_TYPES.includes(ct);
}
function isPdf(ct: string | null | undefined): boolean {
  return ct === 'application/pdf';
}
function typeLabel(ct: string | null | undefined): string {
  if (isImage(ct)) return 'Image';
  if (isPdf(ct))   return 'PDF';
  return 'File';
}

// fmtDate is provided by @/lib/format as fmtDateLong (timezone-aware).
const fmtDate = (iso: string) => fmtDateLong(iso);

// ---------------------------------------------------------------------------
// Lightbox — image-only
// ---------------------------------------------------------------------------
function Lightbox({ url, filename, caption, onClose }: {
  url: string; filename: string; caption: string | null; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[94vh] max-w-[94vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ouc-border px-4 py-3">
          <div className="min-w-0">
            <p className="max-w-[320px] truncate text-[13px] font-semibold text-ouc-text">{filename}</p>
            {caption && <p className="mt-0.5 text-[11.5px] text-ouc-text-muted">{caption}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ouc-text-muted hover:bg-ouc-surface hover:text-ouc-text"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>
        <div className="overflow-auto p-4">
          <img src={url} alt={filename} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload slide-over
// ---------------------------------------------------------------------------
function UploadPanel({ taskId, legacyId, onClose, onSuccess }: {
  taskId: string; legacyId: number; onClose: () => void; onSuccess: () => void;
}) {
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [caption, setCaption]   = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Only JPEG, PNG, WebP, and PDF files are allowed.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
    // Generate an in-browser preview URL for images only — PDFs render with a file icon.
    setPreview(isImage(f.type) ? URL.createObjectURL(f) : null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0] ?? null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setError(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('task_id', taskId);
    fd.append('caption', caption);

    try {
      const res  = await fetch('/api/photos/upload', { method: 'POST', body: fd });
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
        <div className="flex items-center justify-between border-b border-ouc-border px-5 py-4">
          <h2 className="text-[15px] font-bold text-ouc-primary">Upload Attachment</h2>
          <button
            type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ouc-text-muted hover:bg-ouc-surface"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {done ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
              <p className="font-semibold text-ouc-text">Attachment uploaded!</p>
            </div>
          ) : (
            <form id="attachment-upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !file && fileRef.current?.click()}
                className={`relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                  dragOver ? 'border-ouc-accent bg-ouc-accent/5' : file ? 'border-green-400 bg-green-50' : 'border-ouc-border hover:border-ouc-accent/50'
                }`}
              >
                <input ref={fileRef} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

                {file ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-4">
                    {preview ? (
                      <img src={preview} alt="preview" className="h-28 w-28 rounded-lg object-cover shadow" />
                    ) : (
                      <PdfIcon className="h-20 w-20 text-red-500" />
                    )}
                    <p className="max-w-full truncate text-center text-[12.5px] font-semibold text-ouc-text">{file.name}</p>
                    <p className="text-[11px] text-ouc-text-muted">
                      {typeLabel(file.type)} · {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      className="text-[11.5px] text-ouc-text-muted underline hover:text-red-600">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-ouc-text-muted/40">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>
                    </svg>
                    <p className="text-[13px] font-medium text-ouc-text">Drop file here or <span className="text-ouc-accent underline">browse</span></p>
                    <p className="text-[11px] text-ouc-text-muted">JPEG, PNG, WebP, PDF · max {MAX_MB} MB</p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Caption / Description</label>
                <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Before installation, spec sheet, vendor quote"
                  className={fieldCls} />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</div>
              )}
            </form>
          )}
        </div>

        {!done && (
          <div className="border-t border-ouc-border px-5 py-4">
            <button form="attachment-upload-form" type="submit" disabled={uploading || !file}
              className="w-full cursor-pointer rounded-lg bg-ouc-primary py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-ouc-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload Attachment'}
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
export function TaskPhotosCard({
  photos,
  taskId,
  legacyId,
}: {
  /** Misnomer kept for back-compat — array contains BOTH photos and documents. */
  photos: Photo[];
  taskId: string;
  legacyId: number;
}) {
  const router = useRouter();
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [lightbox, setLightbox]         = useState<{ url: string; filename: string; caption: string | null } | null>(null);
  const [loadingId, setLoadingId]       = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  async function fetchSignedUrl(p: Photo): Promise<string | null> {
    const res = await fetch(`/api/receipts/signed-url?path=${encodeURIComponent(p.storage_path)}`);
    const { url, error } = await res.json();
    if (error || !url) return null;
    return url as string;
  }

  async function handleView(p: Photo) {
    setLoadingId(p.id);
    try {
      const url = await fetchSignedUrl(p);
      if (!url) { alert('Could not load attachment.'); return; }
      if (isImage(p.content_type)) {
        setLightbox({ url, filename: p.filename, caption: p.caption });
      } else {
        // PDFs (and any non-image): open in a new tab. We open synchronously
        // after the await to avoid popup blockers in some browsers.
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(p: Photo) {
    if (!confirm(`Delete attachment "${p.filename}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      await deletePhoto(p.id, legacyId);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <section className="rounded-[10px] border border-ouc-border bg-white px-5 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ouc-primary">
            Attachments
            {photos.length > 0 && (
              <span className="ml-2 rounded-full bg-ouc-surface px-2 py-0.5 text-[10px] font-bold text-ouc-text-muted normal-case tracking-normal">
                {photos.length}
              </span>
            )}
          </h2>
        </div>

        {photos.length === 0 ? (
          <p className="mb-3 text-[13px] text-ouc-text-muted">No attachments yet.</p>
        ) : (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg border border-ouc-border bg-ouc-surface">
                <AttachmentThumbnail attachment={p} onView={() => handleView(p)} />
                {p.caption && (
                  <p className="truncate px-2 py-1.5 text-[11px] text-ouc-text-muted">{p.caption}</p>
                )}
                <div className="flex items-center justify-between border-t border-ouc-border px-2 py-1">
                  <span className="text-[10.5px] text-ouc-text-muted">{fmtDate(p.uploaded_at)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleView(p)}
                      disabled={loadingId === p.id}
                      className="rounded border border-ouc-border bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-ouc-text hover:bg-ouc-surface disabled:opacity-50"
                    >
                      {loadingId === p.id ? '…' : 'View'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === p.id ? '…' : 'Del'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setUploaderOpen(true)}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-ouc-border px-3 py-2 text-[12.5px] text-ouc-text-muted transition-colors hover:border-ouc-accent hover:text-ouc-accent"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
          </svg>
          Upload attachment
        </button>
      </section>

      {uploaderOpen && (
        <UploadPanel
          taskId={taskId}
          legacyId={legacyId}
          onClose={() => setUploaderOpen(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {lightbox && (
        <Lightbox
          url={lightbox.url}
          filename={lightbox.filename}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Thumbnail tile — branches on attachment content type.
// Images use a signed-URL <img>; PDFs render a static file-icon tile.
// ---------------------------------------------------------------------------
function AttachmentThumbnail({
  attachment,
  onView,
}: {
  attachment: Photo;
  onView: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const showsImage = isImage(attachment.content_type);

  useEffect(() => {
    if (!showsImage) return; // PDFs don't need a remote thumbnail
    let cancelled = false;
    fetch(`/api/receipts/signed-url?path=${encodeURIComponent(attachment.storage_path)}`)
      .then((r) => r.json())
      .then(({ url }) => { if (!cancelled && url) setThumbUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [attachment.storage_path, showsImage]);

  return (
    <button
      type="button"
      onClick={onView}
      className="block aspect-video w-full overflow-hidden bg-ouc-surface-alt"
      title={attachment.filename}
    >
      {showsImage ? (
        thumbUrl ? (
          <img
            src={thumbUrl}
            alt={attachment.caption ?? attachment.filename}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-ouc-text-muted/30">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>
            </svg>
          </div>
        )
      ) : (
        // PDF tile: file icon + filename
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 py-2">
          <PdfIcon className="h-10 w-10 text-red-500" />
          <span className="max-w-full truncate text-[10.5px] font-semibold text-ouc-text-muted">
            {attachment.filename}
          </span>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PDF file icon (Heroicons document-text outline, sized via className)
// ---------------------------------------------------------------------------
function PdfIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
      <text
        x="12"
        y="18.5"
        textAnchor="middle"
        fontSize="5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        PDF
      </text>
    </svg>
  );
}
