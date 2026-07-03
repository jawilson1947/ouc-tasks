/**
 * /contractors/[id]/edit — edit or delete an existing contractor.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ContractorForm } from '@/components/ContractorForm';
import { updateContractor, deleteContractor } from '../../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await prisma.contractor.findUnique({
    where: { id },
    select: { businessName: true },
  });
  return { title: `${data?.businessName ?? 'Contractor'} — Edit` };
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

  const row = await prisma.contractor.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      primaryFirstName: true,
      primaryLastName: true,
      primaryEmail: true,
      primaryPhone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zipcode: true,
      businessPhone: true,
      notes: true,
      active: true,
    },
  });

  if (!row) notFound();

  // Map to the snake_case shape ContractorForm expects.
  const contractor = {
    id: row.id,
    business_name: row.businessName,
    primary_first_name: row.primaryFirstName,
    primary_last_name: row.primaryLastName,
    primary_email: row.primaryEmail,
    primary_phone: row.primaryPhone,
    address_line1: row.addressLine1,
    address_line2: row.addressLine2,
    city: row.city,
    state: row.state,
    zipcode: row.zipcode,
    business_phone: row.businessPhone,
    notes: row.notes,
    active: row.active,
  };

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
