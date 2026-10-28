"use client";

import { useActionState } from "react";

import { FormSubmit } from "@/app/(app)/form-submit";
import {
  Field,
  FormActions,
  FormError,
  Input,
  LinkButton,
  Select,
  Textarea,
  formPanelClass,
} from "@/components/ui";
import { CLIENT_STATUSES, label } from "@/lib/constants";
import type { ClientFormValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

export function ClientForm({
  action,
  values,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: ClientFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className={formPanelClass(2, "max-w-[860px]")}>
      {state.error ? (
        <div className="col-span-full">
          <FormError message={state.error} />
        </div>
      ) : null}

      <Field label="Name" htmlFor="name" errors={errors.name} required className="col-span-full">
        <Input id="name" name="name" defaultValue={values.name} required maxLength={160} />
      </Field>
      <Field label="Company" htmlFor="company" errors={errors.company}>
        <Input id="company" name="company" defaultValue={values.company} />
      </Field>
      <Field label="Industry" htmlFor="industry" errors={errors.industry}>
        <Input id="industry" name="industry" defaultValue={values.industry} />
      </Field>
      <Field label="Email" htmlFor="email" errors={errors.email}>
        <Input id="email" name="email" type="email" defaultValue={values.email} />
      </Field>
      <Field label="Phone" htmlFor="phone" errors={errors.phone}>
        <Input id="phone" name="phone" defaultValue={values.phone} />
      </Field>
      <Field label="Website" htmlFor="website" errors={errors.website}>
        <Input id="website" name="website" defaultValue={values.website} placeholder="https://" />
      </Field>
      <Field label="Status" htmlFor="status" errors={errors.status}>
        <Select id="status" name="status" defaultValue={values.status}>
          {CLIENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Address line" htmlFor="addressLine" errors={errors.addressLine} className="col-span-full">
        <Input id="addressLine" name="addressLine" defaultValue={values.addressLine} />
      </Field>
      <Field label="City" htmlFor="city" errors={errors.city}>
        <Input id="city" name="city" defaultValue={values.city} />
      </Field>
      <Field label="State" htmlFor="state" errors={errors.state}>
        <Input id="state" name="state" defaultValue={values.state} />
      </Field>
      <Field label="Postal code" htmlFor="postalCode" errors={errors.postalCode}>
        <Input id="postalCode" name="postalCode" defaultValue={values.postalCode} />
      </Field>
      <Field label="Country" htmlFor="country" errors={errors.country}>
        <Input id="country" name="country" defaultValue={values.country} />
      </Field>
      <Field label="Internal notes" htmlFor="notes" errors={errors.notes} className="col-span-full">
        <Textarea id="notes" name="notes" defaultValue={values.notes} rows={3} />
      </Field>

      <FormActions>
        <FormSubmit>{submitLabel}</FormSubmit>
        <LinkButton href={cancelHref} variant="secondary" size="lg">
          Cancel
        </LinkButton>
      </FormActions>
    </form>
  );
}
