"use client";

import { useActionState } from "react";

import { FormSubmit } from "@/app/(app)/form-submit";
import {
  Checkbox,
  Field,
  FormActions,
  FormError,
  Input,
  LinkButton,
  Select,
  formPanelClass,
} from "@/components/ui";
import type { ContactFormValues as Values } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

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
    <form action={formAction} className={formPanelClass(2, "max-w-[760px]")}>
      {state.error ? (
        <div className="col-span-full">
          <FormError message={state.error} />
        </div>
      ) : null}

      <Field label="Client" htmlFor="clientId" errors={errors.clientId} required className="col-span-full">
        <Select id="clientId" name="clientId" defaultValue={values.clientId}>
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
      <Field label="Title" htmlFor="title" errors={errors.title}>
        <Input id="title" name="title" defaultValue={values.title} />
      </Field>
      <Field label="Email" htmlFor="email" errors={errors.email}>
        <Input id="email" name="email" type="email" defaultValue={values.email} />
      </Field>
      <Field label="Phone" htmlFor="phone" errors={errors.phone}>
        <Input id="phone" name="phone" defaultValue={values.phone} />
      </Field>
      <Checkbox name="isPrimary" defaultChecked={values.isPrimary} label="Primary contact for this client" />

      <FormActions>
        <FormSubmit>Save contact</FormSubmit>
        <LinkButton href={cancelHref} variant="secondary" size="lg">
          Cancel
        </LinkButton>
      </FormActions>
    </form>
  );
}
