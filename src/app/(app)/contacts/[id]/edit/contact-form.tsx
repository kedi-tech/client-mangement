"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, CardHeader, Field, FormError, Input, Select } from "@/components/ui";
import type { ContactFormValues as Values } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function ContactForm({
  action,
  values,
  clients,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: Values;
  clients: { id: string; name: string }[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader title="Contact details" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Client" htmlFor="clientId" errors={errors.clientId} required className="sm:col-span-2">
            <Select id="clientId" name="clientId" defaultValue={values.clientId} required>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="First name" htmlFor="firstName" errors={errors.firstName} required>
            <Input id="firstName" name="firstName" defaultValue={values.firstName} required />
          </Field>
          <Field label="Last name" htmlFor="lastName" errors={errors.lastName} required>
            <Input id="lastName" name="lastName" defaultValue={values.lastName} required />
          </Field>
          <Field label="Job title" htmlFor="title" errors={errors.title}>
            <Input id="title" name="title" defaultValue={values.title} />
          </Field>
          <Field label="Email" htmlFor="email" errors={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email} />
          </Field>
          <Field label="Phone" htmlFor="phone" errors={errors.phone}>
            <Input id="phone" name="phone" defaultValue={values.phone} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={values.isPrimary}
              className="size-4 rounded border-slate-300 text-indigo-600"
            />
            Primary contact
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton />
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
