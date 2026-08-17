"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, CardHeader, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { CLIENT_STATUSES, label } from "@/lib/constants";
import type { ClientFormValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

export function ClientForm({
  action,
  values,
  owners,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: ClientFormValues;
  owners: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader title="Company details" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Client name" htmlFor="name" errors={errors.name} required>
            <Input id="name" name="name" defaultValue={values.name} required maxLength={160} />
          </Field>
          <Field label="Legal / company name" htmlFor="company" errors={errors.company}>
            <Input id="company" name="company" defaultValue={values.company} />
          </Field>
          <Field label="Status" htmlFor="status" errors={errors.status} required>
            <Select id="status" name="status" defaultValue={values.status}>
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account owner" htmlFor="ownerId" errors={errors.ownerId}>
            <Select id="ownerId" name="ownerId" defaultValue={values.ownerId}>
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Industry" htmlFor="industry" errors={errors.industry}>
            <Input id="industry" name="industry" defaultValue={values.industry} />
          </Field>
          <Field label="Website" htmlFor="website" errors={errors.website}>
            <Input
              id="website"
              name="website"
              defaultValue={values.website}
              placeholder="https://example.com"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Primary contact details" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" errors={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email} />
          </Field>
          <Field label="Phone" htmlFor="phone" errors={errors.phone}>
            <Input id="phone" name="phone" defaultValue={values.phone} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Address" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Street" htmlFor="addressLine" errors={errors.addressLine} className="sm:col-span-2">
            <Input id="addressLine" name="addressLine" defaultValue={values.addressLine} />
          </Field>
          <Field label="City" htmlFor="city" errors={errors.city}>
            <Input id="city" name="city" defaultValue={values.city} />
          </Field>
          <Field label="State / region" htmlFor="state" errors={errors.state}>
            <Input id="state" name="state" defaultValue={values.state} />
          </Field>
          <Field label="Postal code" htmlFor="postalCode" errors={errors.postalCode}>
            <Input id="postalCode" name="postalCode" defaultValue={values.postalCode} />
          </Field>
          <Field label="Country" htmlFor="country" errors={errors.country}>
            <Input id="country" name="country" defaultValue={values.country} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Internal notes" description="Only visible to your team." />
        <div className="px-5 py-5">
          <Field label="Notes" htmlFor="notes" errors={errors.notes}>
            <Textarea id="notes" name="notes" defaultValue={values.notes} rows={4} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
