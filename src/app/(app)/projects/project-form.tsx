"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, CardHeader, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { PROJECT_STATUSES, label } from "@/lib/constants";
import type { ProjectFormValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

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
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader title="Project details" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Client" htmlFor="clientId" errors={errors.clientId} required className="sm:col-span-2">
            <Select id="clientId" name="clientId" defaultValue={values.clientId} required>
              <option value="" disabled>
                Select a client…
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Project name" htmlFor="name" errors={errors.name} required className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={values.name} required maxLength={160} />
          </Field>

          <Field label="Status" htmlFor="status" errors={errors.status} required>
            <Select id="status" name="status" defaultValue={values.status}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Budget (USD)" htmlFor="budget" errors={errors.budget}>
            <Input
              id="budget"
              name="budget"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values.budget}
            />
          </Field>

          <Field
            label="Project link"
            htmlFor="liveUrl"
            errors={errors.liveUrl}
            hint="Shown to the client in their portal as “Visit project”."
            className="sm:col-span-2"
          >
            <Input
              id="liveUrl"
              name="liveUrl"
              type="url"
              defaultValue={values.liveUrl}
              placeholder="https://app.example.com"
            />
          </Field>

          <Field label="Start date" htmlFor="startDate" errors={errors.startDate}>
            <Input id="startDate" name="startDate" type="date" defaultValue={values.startDate} />
          </Field>

          <Field label="End date" htmlFor="endDate" errors={errors.endDate}>
            <Input id="endDate" name="endDate" type="date" defaultValue={values.endDate} />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            errors={errors.description}
            className="sm:col-span-2"
          >
            <Textarea id="description" name="description" rows={4} defaultValue={values.description} />
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
