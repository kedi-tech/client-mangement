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
import { PROJECT_STATUSES, label } from "@/lib/constants";
import type { ProjectFormValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

export function ProjectForm({
  action,
  values,
  clients,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: ProjectFormValues;
  clients: { id: string; name: string }[];
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

      <Field label="Client" htmlFor="clientId" errors={errors.clientId} required>
        <Select id="clientId" name="clientId" defaultValue={values.clientId} required>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" htmlFor="status" errors={errors.status}>
        <Select id="status" name="status" defaultValue={values.status}>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name" htmlFor="name" errors={errors.name} required className="col-span-full">
        <Input id="name" name="name" defaultValue={values.name} required maxLength={160} />
      </Field>
      <Field label="Budget" htmlFor="budget" errors={errors.budget}>
        <Input
          id="budget"
          name="budget"
          inputMode="decimal"
          defaultValue={values.budget}
          className="font-mono"
        />
      </Field>
      <Field
        label="Project link"
        htmlFor="liveUrl"
        errors={errors.liveUrl}
        hint={'Shown to the client in their portal as "Visit project"'}
      >
        <Input id="liveUrl" name="liveUrl" type="url" defaultValue={values.liveUrl} placeholder="https://" />
      </Field>
      <Field label="Start date" htmlFor="startDate" errors={errors.startDate}>
        <Input id="startDate" name="startDate" type="date" defaultValue={values.startDate} className="py-1.5" />
      </Field>
      <Field label="End date" htmlFor="endDate" errors={errors.endDate}>
        <Input id="endDate" name="endDate" type="date" defaultValue={values.endDate} className="py-1.5" />
      </Field>
      <Field label="Description" htmlFor="description" errors={errors.description} className="col-span-full">
        <Textarea id="description" name="description" defaultValue={values.description} rows={3} />
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
