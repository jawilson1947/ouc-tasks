/**
 * Contractors — list of business entities (NOT users with role='contractor').
 * Backed by the new `contractor` table. Server Component.
 */
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDateLong } from '@/lib/format';

export const metadata = { title: 'Contractors — OUC Infrastructure Tasks' };

type Contractor = {
  id: string;
  business_name: string;
  primary_first_name: string | null;
  primary_last_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  business_phone: string | null;
  active: boolean;
  created_at: string;
};

const FLASH_ERROR_MESSAGES: Record<string, string> = {};

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contractor')
    .select('id, business_name, primary_first_name, primary_last_name, primary_email, primary_phone, address_line1, city, state, zipcode, business_phone, active, created_at')
    .order('business_name');

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Failed to load contractors:</strong> {error.message}
      </div>
    );
  }

  const contractors = (data ?? []) as Contractor[];

  // Open task counts per contractor for the "tasks" cell.
  const ids = contractors.map((c) => c.id);
  const taskCount = new Map<string, number>();
  const openCount = new Map<string, number>();
  if (ids.length > 0) {
    const { data: links } = await supabase
      .from('task')
      .select('contractor_id, status')
      .in('contractor_id', ids);
    for (const row of links ?? []) {
      if (!row.contractor_id) continue;
      taskCount.set(row.contractor_id, (taskCount.get(row.contractor_id) ?? 0) + 1);
      if (row.status !== 'done') {
        openCount.set(row.contractor_id, (openCount.get(row.contractor_id) ?? 0) + 1);
      }
    }
  }

  const errorMessage = params.error
    ? FLASH_ERROR_MESSAGES[params.error] ?? params.error
    : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ouc-primary">Contractors</h1>
          <div className="text-[13.5px] text-ouc-text-muted">
            {contractors.length} business{contractors.length === 1 ? '' : 'es'} on file
          </div>
        </div>
        <Link
          href="/contractors/new"
          className="rounded-lg bg-ouc-primary px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-ouc-primary-hover"
        >
          + New Contractor
        </Link>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {errorMessage}
        </div>
      )}
      {params.deleted && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Contractor deleted.
        </div>
      )}

      {contractors.length === 0 ? (
        <div className="rounded-[10px] border border-ouc-border bg-white px-6 py-10 text-center shadow-sm">
          <div className="mb-2 text-base font-semibold text-ouc-text">No contractors yet</div>
          <p className="mx-auto mb-4 max-w-md text-[13.5px] text-ouc-text-muted">
            Add the businesses you contract with — vendors, sub-contractors, service providers.
            Once they&apos;re here, you can link them to tasks from the task entry form.
          </p>
          <Link
            href="/contractors/new"
            className="inline-block rounded-lg bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
          >
            + Add the first contractor
          </Link>
        </div>
      ) : (
        <div className="rounded-[10px] border border-ouc-border bg-white shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Business</Th>
                <Th>Primary contact</Th>
                <Th>Phone</Th>
                <Th>Location</Th>
                <Th>Tasks</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((c) => {
                const contactName = [c.primary_first_name, c.primary_last_name]
                  .filter(Boolean)
                  .join(' ');
                const cityState = [c.city, c.state].filter(Boolean).join(', ');
                const total = taskCount.get(c.id) ?? 0;
                const open = openCount.get(c.id) ?? 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-ouc-border last:border-b-0 hover:bg-ouc-surface"
                  >
                    <Td>
                      <Link
                        href={`/contractors/${c.id}/edit`}
                        className="font-semibold text-ouc-text hover:text-ouc-accent"
                      >
                        {c.business_name}
                      </Link>
                      {!c.active && (
                        <span className="ml-2 rounded-full bg-ouc-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ouc-text-muted">
                          Inactive
                        </span>
                      )}
                    </Td>
                    <Td>
                      {contactName ? (
                        <>
                          <div>{contactName}</div>
                          {c.primary_email && (
                            <a
                              href={`mailto:${c.primary_email}`}
                              className="text-[11.5px] text-ouc-accent hover:underline"
                            >
                              {c.primary_email}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-ouc-text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-ouc-text-muted">
                      {c.business_phone ?? c.primary_phone ?? '—'}
                    </Td>
                    <Td className="text-ouc-text-muted">{cityState || '—'}</Td>
                    <Td>
                      {total === 0 ? (
                        <span className="text-ouc-text-muted">No tasks</span>
                      ) : (
                        <span>
                          <strong className="text-ouc-text">{open}</strong>{' '}
                          <span className="text-ouc-text-muted">open · {total} total</span>
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/contractors/${c.id}/edit`}
                        className="rounded border border-ouc-border bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ouc-text hover:bg-ouc-surface-alt"
                      >
                        Edit
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
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

function Td({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={`px-3 py-2.5 align-middle ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}
