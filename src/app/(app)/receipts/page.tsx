/**
 * Receipts — list of attachments where type='receipt'.
 * Server Component. Upload UI is deferred until file storage is wired up.
 */
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { fmtUSD, fmtDateLong } from '@/lib/format';

export const metadata = { title: 'Receipts — OUC Infrastructure Tasks' };

type Receipt = {
  id: string;
  task_id: string | null;
  filename: string;
  vendor: string | null;
  receipt_amount: number | null;
  receipt_date: string | null;
  caption: string | null;
  uploaded_at: string;
};

type Task = {
  id: string;
  legacy_id: number | null;
  title: string;
};

export default async function ReceiptsPage() {
  let rows;
  try {
    // MySQL sorts NULLs last on DESC, which matches the old Supabase
    // `nullsFirst: false` ordering — no JS re-sort needed here.
    rows = await prisma.attachment.findMany({
      where: { type: 'receipt' },
      orderBy: [{ receiptDate: 'desc' }, { uploadedAt: 'desc' }],
      include: { task: { select: { id: true, legacyId: true, title: true } } },
    });
  } catch (e) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load receipts:</strong> {(e as Error).message}
      </div>
    );
  }

  const receipts: Receipt[] = rows.map((r) => ({
    id: r.id,
    task_id: r.taskId,
    filename: r.filename,
    vendor: r.vendor,
    receipt_amount: r.receiptAmount != null ? Number(r.receiptAmount) : null,
    receipt_date: r.receiptDate ? r.receiptDate.toISOString().slice(0, 10) : null,
    caption: r.caption,
    uploaded_at: r.uploadedAt.toISOString(),
  }));

  const taskMap = new Map<string, Task>(
    rows
      .filter((r) => r.task != null)
      .map((r) => [
        r.task!.id,
        { id: r.task!.id, legacy_id: r.task!.legacyId, title: r.task!.title },
      ])
  );

  const total = receipts.reduce(
    (sum, r) => sum + Number(r.receipt_amount ?? 0),
    0
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">Receipts</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {receipts.length} receipt{receipts.length === 1 ? '' : 's'} logged ·{' '}
            <span className="font-semibold">{fmtUSD(total)}</span> total spend recorded
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Upload — coming soon (needs file-storage wiring)"
          className="cursor-not-allowed rounded-lg bg-ouc-primary px-3.5 py-2 text-[13.5px] font-semibold text-white opacity-60"
        >
          + Upload Receipt
        </button>
      </div>

      {receipts.length === 0 ? (
        <div className="rounded-[10px] border border-ouc-border bg-white px-6 py-10 text-center shadow-sm">
          <div className="mb-2 text-base font-semibold text-ouc-text">No receipts yet</div>
          <p className="mx-auto max-w-md text-[13.5px] text-ouc-text-muted">
            Receipts uploaded against any task will collect here so you can track
            actual spend against estimates. Upload UI is the next chunk to land —
            it needs file storage and a Server Action for the upload itself.
          </p>
        </div>
      ) : (
        <div className="rounded-[10px] border border-ouc-border bg-white shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Vendor</Th>
                <Th>Description</Th>
                <Th>Task</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => {
                const task = r.task_id ? taskMap.get(r.task_id) : null;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-ouc-border last:border-b-0 hover:bg-ouc-surface"
                  >
                    <Td>{fmtDateLong(r.receipt_date ?? r.uploaded_at)}</Td>
                    <Td>{r.vendor ?? <span className="text-ouc-text-muted">—</span>}</Td>
                    <Td>
                      <div className="font-medium text-ouc-text">{r.filename}</div>
                      {r.caption && (
                        <div className="text-[11.5px] text-ouc-text-muted">{r.caption}</div>
                      )}
                    </Td>
                    <Td>
                      {task ? (
                        <Link
                          href={`/tasks/${task.legacy_id ?? ''}`}
                          className="text-ouc-accent hover:underline"
                        >
                          #{task.legacy_id ?? '—'} · {task.title}
                        </Link>
                      ) : (
                        <span className="text-ouc-text-muted">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="font-semibold tabular-nums">
                        {r.receipt_amount != null ? fmtUSD(Number(r.receipt_amount)) : '—'}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ouc-border bg-ouc-surface">
                <td className="px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-ouc-text-muted" colSpan={4}>
                  Total recorded spend
                </td>
                <td className="px-3 py-2.5 text-right text-[15px] font-bold tabular-nums text-ouc-primary">
                  {fmtUSD(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`border-b border-ouc-border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-3 py-2.5 align-top ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
