"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { ConfirmForm } from "@/components/confirm-form";
import { Button, CardHeader, EmptyRow, Field, FormError, Input, Pill, Select } from "@/components/ui";
import { PROVIDED_BY_LABELS, SERVICE_KIND_LABELS, SERVICE_KINDS, SERVICE_PROVIDERS } from "@/lib/constants";
import { RENEWAL_COLOR } from "@/lib/services";
import type { FormState } from "@/lib/validation";
import { createServiceAction, deleteServiceAction, updateServiceAction } from "@/server/actions/services";

/** A domain or hosting plan, pre-formatted on the server (see `toServiceRow`). */
export type ServiceRow = {
  id: string;
  kind: string;
  name: string;
  providedBy: string;
  provider: string;
  notes: string;
  /** yyyy-mm-dd for the date input, "" when unset. */
  renewsAtInput: string;
  renewalLabel: string;
  renewalState: "none" | "expired" | "soon" | "ok";
  /** "$15.00", or "" when there is no price. */
  price: string;
  /** Plain number for the price input. */
  priceInput: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="text-[12.5px]">
      {pending ? "Saving…" : label}
    </Button>
  );
}

function ServiceForm({
  projectId,
  service,
  onDone,
}: {
  projectId: string;
  service?: ServiceRow;
  onDone: () => void;
}) {
  const action = service ? updateServiceAction.bind(null, service.id) : createServiceAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [providedBy, setProvidedBy] = useState(service?.providedBy ?? "US");
  const [kind, setKind] = useState(service?.kind ?? "DOMAIN");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const errors = state.fieldErrors ?? {};
  const prefix = service ? `svc-${service.id}` : "svc-new";

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-2.5 border-b border-l2 bg-hov px-3.5 py-3 min-[720px]:grid-cols-2"
    >
      <input type="hidden" name="projectId" value={projectId} />
      {state.error ? (
        <div className="col-span-full">
          <FormError message={state.error} />
        </div>
      ) : null}
      <Field label="Type" htmlFor={`${prefix}-kind`} errors={errors.kind} size="sm">
        <Select id={`${prefix}-kind`} name="kind" size="sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          {SERVICE_KINDS.map((value) => (
            <option key={value} value={value}>
              {SERVICE_KIND_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Who paid for it" htmlFor={`${prefix}-by`} errors={errors.providedBy} size="sm">
        <Select
          id={`${prefix}-by`}
          name="providedBy"
          size="sm"
          value={providedBy}
          onChange={(e) => setProvidedBy(e.target.value)}
        >
          {SERVICE_PROVIDERS.map((value) => (
            <option key={value} value={value}>
              {value === "US" ? "We bought it" : "The client provided it"}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={kind === "DOMAIN" ? "Domain" : "Plan or server"}
        htmlFor={`${prefix}-name`}
        errors={errors.name}
        required
        size="sm"
      >
        <Input
          id={`${prefix}-name`}
          name="name"
          size="sm"
          defaultValue={service?.name}
          placeholder={kind === "DOMAIN" ? "example.com" : "Business hosting plan"}
          required
        />
      </Field>
      <Field
        label={kind === "DOMAIN" ? "Registrar" : "Hosting company"}
        htmlFor={`${prefix}-provider`}
        errors={errors.provider}
        size="sm"
      >
        <Input
          id={`${prefix}-provider`}
          name="provider"
          size="sm"
          defaultValue={service?.provider}
          placeholder={kind === "DOMAIN" ? "Namecheap" : "Hostinger"}
        />
      </Field>
      <Field label="Renews on" htmlFor={`${prefix}-renews`} errors={errors.renewsAt} size="sm">
        <Input id={`${prefix}-renews`} name="renewsAt" type="date" size="sm" defaultValue={service?.renewsAtInput} />
      </Field>
      <Field
        label="Renewal price"
        htmlFor={`${prefix}-price`}
        errors={errors.price}
        size="sm"
        hint={providedBy === "US" ? "What the client pays us at renewal." : "Optional for client-provided."}
      >
        <Input
          id={`${prefix}-price`}
          name="price"
          size="sm"
          inputMode="decimal"
          defaultValue={service?.priceInput ?? ""}
          placeholder="0.00"
          className="font-mono"
        />
      </Field>
      <Field label="Notes" htmlFor={`${prefix}-notes`} errors={errors.notes} size="sm" className="col-span-full">
        <Input
          id={`${prefix}-notes`}
          name="notes"
          size="sm"
          defaultValue={service?.notes}
          placeholder="Account login, DNS details, who to contact…"
        />
      </Field>
      <div className="col-span-full flex gap-2">
        <Submit label={service ? "Save changes" : "Add"} />
        <Button variant="secondary" className="text-[12.5px]" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** "Domain & hosting" panel on a project's page. */
export function ServicesPanel({ projectId, services }: { projectId: string; services: ServiceRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <CardHeader
        title="Domain & hosting"
        description={`${services.length} on file`}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAdding((value) => !value);
              setEditing(null);
            }}
          >
            Add domain or hosting
          </Button>
        }
      />
      {adding ? <ServiceForm projectId={projectId} onDone={() => setAdding(false)} /> : null}
      {services.length === 0 && !adding ? (
        <EmptyRow>No domain or hosting recorded yet.</EmptyRow>
      ) : null}
      {services.map((service) =>
        editing === service.id ? (
          <ServiceForm key={service.id} projectId={projectId} service={service} onDone={() => setEditing(null)} />
        ) : (
          <div
            key={service.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-l2 px-3.5 py-[9px] last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={service.kind === "DOMAIN" ? "font-mono text-[13px]" : "text-[13px] font-medium"}>
                  {service.name}
                </span>
                <Pill tone={service.kind === "DOMAIN" ? "indigo" : "sky"}>{SERVICE_KIND_LABELS[service.kind]}</Pill>
                <Pill tone={service.providedBy === "US" ? "emerald" : "slate"}>
                  {PROVIDED_BY_LABELS[service.providedBy]}
                </Pill>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-fa">
                {service.provider ? <span>{service.provider}</span> : null}
                <span className={RENEWAL_COLOR[service.renewalState]}>{service.renewalLabel}</span>
                {service.price ? <span className="font-mono">{service.price} / renewal</span> : null}
              </div>
              {service.notes ? <div className="mt-0.5 text-[12.5px] text-mu">{service.notes}</div> : null}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="px-2 py-[3px]"
                onClick={() => {
                  setEditing(service.id);
                  setAdding(false);
                }}
              >
                Edit
              </Button>
              <ConfirmForm
                action={deleteServiceAction}
                hidden={{ serviceId: service.id }}
                confirmMessage={`Remove ${service.name}?`}
                className="flex"
                buttonTextClass="px-2 py-[3px] text-[12px]"
              >
                Delete
              </ConfirmForm>
            </div>
          </div>
        ),
      )}
    </>
  );
}
