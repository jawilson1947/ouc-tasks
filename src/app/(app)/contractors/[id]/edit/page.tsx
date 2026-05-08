/**
 * /contractors/[id]/edit — edit or delete an existing contractor.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContractorForm } from '@/components/ContractorForm';
import { updateContractor, deleteContractor } from '../../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('contractor')
    .select('business_name')
    .eq('id', id)
    .maybeSingle();
  return { title: `${data?.business_name ?? 'Contractor'} — Edit` };
}

export default async function EditContractorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; created?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: contractor, error } = await supabase
    .from('contractor')
    .select('id, business_name, primary_first_name, primary_last_name, primary_email, primary_phone, address_line1, address_line2, city, state, zipcode, business_phone, notes, active')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load contractor: {error.message}
      </div>
    );
  }
  if (!contractor) notFound();

  return (
    <div>
      <div className="mb-2 text-[12.5px] text-ouc-text-muted">
        <Link href="/contractors" className="hover:text-ouc-primary">Contractors</Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span>{contractor.business_name}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-ouc-primary">
          {contractor.business_name}
        </h1>
        <form action={deleteContractor}>
          <input type="hidden" name="id" value={contractor.id} />
          <button
            type="submit"
            className="cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50"
          >
            Delete contractor
          </button>
        </form>
      </div>

      {/* Flash messages */}
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {sp.error}
        </div>
      )}
      {sp.created && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Contractor created. You can link tasks to them now from the task entry form.
        </div>
      )}
      {sp.saved && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] font-medium text-green-800">
          Saved.
        </div>
      )}

      <ContractorForm
        action={updateContractor}
        defaults={contractor}
        submitLabel="Save changes"
        isEdit
      />
    </div>
  );
}
