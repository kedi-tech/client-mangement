"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, CardHeader, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { INVOICE_STATUSES, label } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { emptyLine, type InvoiceFormValues, type InvoiceLineValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

function toCents(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function InvoiceForm({
  action,
  values,
  clients,
  projects,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: InvoiceFormValues;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [clientId, setClientId] = useState(values.clientId);
  const [lines, setLines] = useState<InvoiceLineValues[]>(
    values.items.length > 0 ? values.items : [{ ...emptyLine }],
  );
  const [taxRate, setTaxRate] = useState(values.taxRate);

  const errors = state.fieldErrors ?? {};
  const visibleProjects = projects.filter((project) => project.clientId === clientId);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + Math.round((Number(line.quantity) || 0) * toCents(line.unitPrice)),
      0,
    );
    const rate = Number(taxRate) || 0;
    const tax = Math.round((subtotal * rate) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [lines, taxRate]);

  function updateLine(index: number, patch: Partial<InvoiceLineValues>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader title="Invoice details" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Client" htmlFor="clientId" errors={errors.clientId} required>
            <Select
              id="clientId"
              name="clientId"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              required
            >
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

          <Field label="Project" htmlFor="projectId" errors={errors.projectId} hint="Optional.">
            <Select id="projectId" name="projectId" defaultValue={values.projectId}>
              <option value="">No project</option>
              {visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Invoice number" htmlFor="number" errors={errors.number} required>
            <Input id="number" name="number" defaultValue={values.number} required maxLength={40} />
          </Field>

          <Field label="Status" htmlFor="status" errors={errors.status}>
            <Select id="status" name="status" defaultValue={values.status}>
              {INVOICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Issue date" htmlFor="issueDate" errors={errors.issueDate}>
            <Input id="issueDate" name="issueDate" type="date" defaultValue={values.issueDate} />
          </Field>

          <Field label="Due date" htmlFor="dueDate" errors={errors.dueDate}>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} />
          </Field>

          <Field label="Tax rate (%)" htmlFor="taxRate" errors={errors.taxRate}>
            <Input
              id="taxRate"
              name="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Line items"
          description="Quantity × unit price. Rows left blank are ignored."
          action={
            <button
              type="button"
              onClick={() => setLines((current) => [...current, { ...emptyLine }])}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Add line
            </button>
          }
        />

        {errors.items?.length ? (
          <div className="px-5 pt-4">
            <FormError message={errors.items[0]} />
          </div>
        ) : null}

        <div className="space-y-3 px-5 py-5">
          {lines.map((line, index) => {
            const lineTotal = Math.round((Number(line.quantity) || 0) * toCents(line.unitPrice));
            return (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12 sm:items-end dark:border-slate-800"
              >
                <div className="sm:col-span-6">
                  <label
                    htmlFor={`itemDescription-${index}`}
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Description
                  </label>
                  <Input
                    id={`itemDescription-${index}`}
                    name="itemDescription"
                    value={line.description}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
                    placeholder="Design sprint — 2 weeks"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`itemQuantity-${index}`}
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Qty
                  </label>
                  <Input
                    id={`itemQuantity-${index}`}
                    name="itemQuantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`itemUnitPrice-${index}`}
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Unit price
                  </label>
                  <Input
                    id={`itemUnitPrice-${index}`}
                    name="itemUnitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(lineTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) =>
                        current.length === 1
                          ? [{ ...emptyLine }]
                          : current.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`Remove line ${index + 1}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
              <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(totals.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Tax ({Number(taxRate) || 0}%)</dt>
              <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(totals.tax)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold dark:border-slate-800">
              <dt className="text-slate-900 dark:text-slate-100">Total</dt>
              <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(totals.total)}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes" description="Shown on the invoice." />
        <div className="px-5 py-5">
          <Field label="Notes" htmlFor="notes" errors={errors.notes}>
            <Textarea id="notes" name="notes" rows={3} defaultValue={values.notes} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Submit>{submitLabel}</Submit>
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
