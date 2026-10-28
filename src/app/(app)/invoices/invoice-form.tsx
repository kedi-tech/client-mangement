"use client";

import { useActionState, useMemo, useState } from "react";

import { FormSubmit } from "@/app/(app)/form-submit";
import {
  Button,
  Card,
  Field,
  FormError,
  GridHead,
  GridTable,
  Input,
  LinkButton,
  Select,
  formPanelClass,
} from "@/components/ui";
import { INVOICE_STATUSES, label } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { emptyLine, type InvoiceFormValues, type InvoiceLineValues } from "@/lib/form-defaults";
import type { FormState } from "@/lib/validation";

const LINE_COLS = "minmax(200px,1fr) 80px 120px 120px 70px";

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
  // Line errors arrive keyed "items" or "items.0.quantity"; show the first one.
  const lineError = Object.entries(errors).find(([key]) => key.startsWith("items"))?.[1]?.[0];

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
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const lineInput = "px-[9px] py-1.5 text-[13px]";

  return (
    <form action={formAction} className="flex max-w-[980px] flex-col gap-4">
      <FormError message={state.error} />

      <div className={formPanelClass(3, "gap-3 p-4")}>
        <Field label="Client" htmlFor="clientId" errors={errors.clientId} required>
          <Select
            id="clientId"
            name="clientId"
            size="sm"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            required
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="projectId" errors={errors.projectId}>
          <Select
            key={clientId}
            id="projectId"
            name="projectId"
            size="sm"
            defaultValue={clientId === values.clientId ? values.projectId : ""}
          >
            <option value="">No project</option>
            {visibleProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Number" htmlFor="number" errors={errors.number} required>
          <Input
            id="number"
            name="number"
            size="sm"
            defaultValue={values.number}
            required
            maxLength={40}
            className="font-mono"
          />
        </Field>
        <Field label="Status" htmlFor="status" errors={errors.status}>
          <Select id="status" name="status" size="sm" defaultValue={values.status}>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Issue date" htmlFor="issueDate" errors={errors.issueDate}>
          <Input id="issueDate" name="issueDate" type="date" size="sm" defaultValue={values.issueDate} />
        </Field>
        <Field label="Due date" htmlFor="dueDate" errors={errors.dueDate} hint="Net-30 by default">
          <Input id="dueDate" name="dueDate" type="date" size="sm" defaultValue={values.dueDate} />
        </Field>
        <Field label="Tax rate %" htmlFor="taxRate" errors={errors.taxRate}>
          <Input
            id="taxRate"
            name="taxRate"
            size="sm"
            inputMode="decimal"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Notes" htmlFor="notes" errors={errors.notes} className="min-[720px]:col-span-2">
          <Input
            id="notes"
            name="notes"
            size="sm"
            defaultValue={values.notes}
            placeholder="Printed on the invoice"
          />
        </Field>
      </div>

      <Card>
        <GridTable minWidth={640}>
          <GridHead cols={LINE_COLS}>
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </GridHead>
          {lines.map((line, index) => {
            const lineTotal = Math.round((Number(line.quantity) || 0) * toCents(line.unitPrice));
            return (
              <div
                key={index}
                className="grid items-center gap-2.5 border-b border-l2 px-3.5 py-2"
                style={{ gridTemplateColumns: LINE_COLS }}
              >
                <Input
                  name="itemDescription"
                  aria-label={`Line ${index + 1} description`}
                  value={line.description}
                  onChange={(event) => updateLine(index, { description: event.target.value })}
                  placeholder="What was delivered"
                  className={lineInput}
                />
                <Input
                  name="itemQuantity"
                  aria-label={`Line ${index + 1} quantity`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  placeholder="1"
                  className={`${lineInput} font-mono`}
                />
                <Input
                  name="itemUnitPrice"
                  aria-label={`Line ${index + 1} unit price`}
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                  placeholder="0.00"
                  className={`${lineInput} font-mono`}
                />
                <span className="text-right font-mono text-[13px]">{formatMoney(lineTotal)}</span>
                <Button
                  variant="linkDanger"
                  className="justify-self-end"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1 ? [{ ...emptyLine }] : current.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <div className="flex flex-wrap justify-between gap-4 px-3.5 py-3">
            <div className="flex flex-col gap-1.5">
              <Button
                variant="secondary"
                className="self-start px-2.5 py-[5px] text-[12.5px]"
                onClick={() => setLines((current) => [...current, { ...emptyLine }])}
              >
                Add line
              </Button>
              {lineError ? <span className="text-[12px] text-red">{lineError}</span> : null}
              <span className="text-[12px] text-fa">Rows left blank are ignored.</span>
            </div>
            <div className="grid grid-cols-[auto_130px] gap-x-[18px] gap-y-1.5 text-[13px]">
              <span className="text-mu">Subtotal</span>
              <span className="text-right font-mono">{formatMoney(totals.subtotal)}</span>
              <span className="text-mu">Tax ({Number(taxRate) || 0}%)</span>
              <span className="text-right font-mono">{formatMoney(totals.tax)}</span>
              <span className="border-t border-ln pt-1.5 font-semibold">Total</span>
              <span className="border-t border-ln pt-1.5 text-right font-mono font-semibold">
                {formatMoney(totals.total)}
              </span>
            </div>
          </div>
        </GridTable>
      </Card>

      <div className="flex gap-2">
        <FormSubmit>{submitLabel}</FormSubmit>
        <LinkButton href={cancelHref} variant="secondary" size="lg">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
