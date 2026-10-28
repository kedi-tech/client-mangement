"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, CardHeader, Checkbox, Field, FormError, Input, Textarea } from "@/components/ui";
import { addNoteAction } from "@/server/actions/clients";
import { createContactAction } from "@/server/actions/contacts";
import type { FormState } from "@/lib/validation";

function Submit({ children, className }: { children: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className ?? "text-[12.5px]"}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

/**
 * Header of the Contacts panel with its "Add contact" toggle. The form opens
 * below the header, above the contact list, as in the design.
 */
export function ContactsHeader({ clientId, count }: { clientId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(createContactAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  const errors = state.fieldErrors ?? {};

  return (
    <>
      <CardHeader
        title="Contacts"
        description={`${count} on file`}
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
            Add contact
          </Button>
        }
      />
      {open ? (
        <form
          ref={formRef}
          action={formAction}
          className="grid grid-cols-1 gap-2.5 border-b border-l2 bg-hov px-3.5 py-3 min-[720px]:grid-cols-2"
        >
          <input type="hidden" name="clientId" value={clientId} />
          {state.error ? (
            <div className="col-span-full">
              <FormError message={state.error} />
            </div>
          ) : null}
          <Field label="First name" htmlFor="firstName" errors={errors.firstName} required size="sm">
            <Input id="firstName" name="firstName" size="sm" required />
          </Field>
          <Field label="Last name" htmlFor="lastName" errors={errors.lastName} required size="sm">
            <Input id="lastName" name="lastName" size="sm" required />
          </Field>
          <Field label="Title" htmlFor="title" errors={errors.title} size="sm">
            <Input id="title" name="title" size="sm" />
          </Field>
          <Field label="Email" htmlFor="contactEmail" errors={errors.email} size="sm">
            <Input id="contactEmail" name="email" type="email" size="sm" />
          </Field>
          <Field label="Phone" htmlFor="contactPhone" errors={errors.phone} size="sm">
            <Input id="contactPhone" name="phone" size="sm" />
          </Field>
          <Checkbox name="isPrimary" label="Primary contact" />
          <div className="flex gap-2">
            <Submit>Save contact</Submit>
            <Button variant="secondary" className="text-[12.5px]" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}

/** Note composer above the client's note history. */
export function AddNoteForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(addNoteAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-b border-l2 px-3.5 py-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state.error} />
      <Textarea
        id="body"
        name="body"
        rows={3}
        maxLength={5000}
        aria-label="Add a note"
        placeholder="What came out of the last conversation?"
        size="sm"
        required
      />
      {state.fieldErrors?.body ? (
        <span className="text-[12px] text-red">{state.fieldErrors.body[0]}</span>
      ) : null}
      <div>
        <Submit className="px-2.5 py-[5px] text-[12px]">Add note</Submit>
      </div>
    </form>
  );
}
