/**
 * /contractors/new — create a new contractor.
 */
import Link from 'next/link';
import { ContractorForm } from '@/components/ContractorForm';
import { createContractor } from '../actions';

export const metadata = { title: 'New Contractor — OUC Infrastructure Tasks' };

export default async function NewContractorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/contractors" className="hover:text-ouc-primary">Contractors</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>New</span>
      </div>
      <h1 className="mb-5 text-2xl font-bold text-ouc-primary">New Contractor</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}

      <ContractorForm action={createContractor} submitLabel="Create contractor" />
    </div>
  );
}
