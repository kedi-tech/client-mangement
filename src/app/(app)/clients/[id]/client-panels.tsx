"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input, Textarea } from "@/components/ui";
import { addNoteAction } from "@/server/actions/clients";
import { createContactAction } from "@/server/actions/contacts";
import type { FormState } from "@/lib/validation";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

/** Collapsible "add contact" form living inside the client detail page. */
export function AddContactForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(createContactAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Add contact
      </button>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 w-full space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" errors={errors.firstName} required>
          <Input id="firstName" name="firstName" required />
        </Field>
        <Field label="Last name" htmlFor="lastName" errors={errors.lastName} required>
          <Input id="lastName" name="lastName" required />
        </Field>
        <Field label="Job title" htmlFor="title" errors={errors.title}>
          <Input id="title" name="title" />
        </Field>
        <Field label="Email" htmlFor="contactEmail" errors={errors.email}>
          <Input id="contactEmail" name="email" type="email" />
        </Field>
        <Field label="Phone" htmlFor="contactPhone" errors={errors.phone}>
          <Input id="contactPhone" name="phone" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            name="isPrimary"
            className="size-4 rounded border-slate-300 text-indigo-600"
          />
          Primary contact
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Submit>Add contact</Submit>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
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
    <form ref={formRef} action={formAction} className="space-y-3 px-5 py-5">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state.error} />
      <Field label="Add a note" htmlFor="body" errors={state.fieldErrors?.body}>
        <Textarea
          id="body"
          name="body"
          rows={3}
          placeholder="What came out of the last conversation?"
          required
        />
      </Field>
      <Submit>Save note</Submit>
    </form>
  );
}
