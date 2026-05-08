/**
 * ContractorForm — server-renderable form shared by /contractors/new and
 * /contractors/[id]/edit. The parent page passes in the Server Action and
 * (for edit) the row's existing values.
 */
import Link from 'next/link';

export type ContractorDefaults = {
  id?: string;
  business_name?: string | null;
  primary_first_name?: string | null;
  primary_last_name?: string | null;
  primary_email?: string | null;
  primary_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  business_phone?: string | null;
  notes?: string | null;
};

export function ContractorForm({
  action,
  defaults = {},
  submitLabel = 'Create contractor',
  isEdit = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: ContractorDefaults;
  submitLabel?: string;
  isEdit?: boolean;
}) {
  return (
    <form
      action={action}
      className="rounded-[10px] border border-ouc-border bg-white px-5 py-5 shadow-sm"
    >
      {isEdit && defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <Section title="Business">
        <Field label="Business name" required colSpan={2}>
          <input
            name="business_name"
            type="text"
            required
            defaultValue={defaults.business_name ?? ''}
            className={INPUT}
          />
        </Field>
        <Field label="Business phone">
          <input
            name="business_phone"
            type="tel"
            defaultValue={defaults.business_phone ?? ''}
            placeholder="(555) 123-4567"
            className={INPUT}
          />
        </Field>
      </Section>

      <Section title="Primary contact">
        <Field label="First name">
          <input
            name="primary_first_name"
            type="text"
            defaultValue={defaults.primary_first_name ?? ''}
            className={INPUT}
          />
        </Field>
        <Field label="Last name">
          <input
            name="primary_last_name"
            type="text"
            defaultValue={defaults.primary_last_name ?? ''}
            className={INPUT}
          />
        </Field>
        <Field label="Email">
          <input
            name="primary_email"
            type="email"
            defaultValue={defaults.primary_email ?? ''}
            placeholder="contact@business.com"
            className={INPUT}
          />
        </Field>
        <Field label="Mobile / direct phone">
          <input
            name="primary_phone"
            type="tel"
            defaultValue={defaults.primary_phone ?? ''}
            className={INPUT}
          />
        </Field>
      </Section>

      <Section title="Mailing address">
        <Field label="Address line 1" colSpan={3}>
          <input
            name="address_line1"
            type="text"
            defaultValue={defaults.address_line1 ?? ''}
            className={INPUT}
          />
        </Field>
        <Field label="Address line 2" colSpan={3}>
          <input
            name="address_line2"
            type="text"
            defaultValue={defaults.address_line2 ?? ''}
            placeholder="Suite, unit, etc."
            className={INPUT}
          />
        </Field>
        <Field label="City">
          <input
            name="city"
            type="text"
            defaultValue={defaults.city ?? ''}
            className={INPUT}
          />
        </Field>
        <Field label="State">
          <input
            name="state"
            type="text"
            maxLength={2}
            defaultValue={defaults.state ?? ''}
            placeholder="AL"
            className={INPUT}
          />
        </Field>
        <Field label="Zip code">
          <input
            name="zipcode"
            type="text"
            defaultValue={defaults.zipcode ?? ''}
            placeholder="35896"
            className={INPUT}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" colSpan={3}>
          <textarea
            name="notes"
            rows={3}
            defaultValue={defaults.notes ?? ''}
            placeholder="Trade specialty, license #, insurance carrier — anything useful when picking a contractor for a task."
            className={`${INPUT} resize-y`}
          />
        </Field>
      </Section>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-ouc-border pt-4">
        <Link
          href="/contractors"
          className="rounded-md border border-ouc-border bg-white px-4 py-2 text-[13px] font-medium text-ouc-text hover:bg-ouc-surface-alt"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="cursor-pointer rounded-md bg-ouc-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-ouc-primary-hover"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const INPUT =
  'w-full rounded-md border border-ouc-border bg-white px-2.5 py-1.5 text-[13.5px] focus:border-ouc-accent focus:outline-none focus:ring-2 focus:ring-ouc-accent/20';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ouc-text-muted">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  required,
  colSpan = 1,
  children,
}: {
  label: string;
  required?: boolean;
  colSpan?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const span =
    colSpan === 3 ? 'md:col-span-3' : colSpan === 2 ? 'md:col-span-2' : '';
  return (
    <label className={`flex flex-col gap-1 ${span}`}>
      <span className="text-[12px] font-semibold text-ouc-text">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
