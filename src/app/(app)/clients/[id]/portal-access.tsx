"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import {
  createPortalUserAction,
  resetPortalPasswordAction,
} from "@/server/actions/portal-access";

/** Readable, reasonably strong temporary password to hand to a client. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  errors,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      errors={errors}
      hint="Share this with the client over a channel you trust. They can keep using it, or you can reset it here later."
      required
    >
      <div className="flex gap-2">
        <Input
          id={id}
          name="password"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={8}
          required
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="button" variant="secondary" onClick={() => onChange(generatePassword())}>
          Generate
        </Button>
      </div>
    </Field>
  );
}

/** Create the first (or an additional) portal login for this client. */
export function CreatePortalUser({
  clientId,
  defaultName,
  defaultEmail,
}: {
  clientId: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, formAction] = useActionState<FormState, FormData>(createPortalUserAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPassword("");
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setPassword(generatePassword());
          setOpen(true);
        }}
        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Invite to portal
      </button>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 border-t border-slate-200 bg-slate-50/60 px-5 py-5 dark:border-slate-800 dark:bg-slate-800/30"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state.error} />

      <Field label="Their name" htmlFor="portalName" errors={errors.name} required>
        <Input id="portalName" name="name" defaultValue={defaultName} required />
      </Field>

      <Field label="Their email" htmlFor="portalEmail" errors={errors.email} required>
        <Input
          id="portalEmail"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          required
          autoComplete="off"
        />
      </Field>

      <PasswordField
        id="portalPassword"
        label="Temporary password"
        value={password}
        onChange={setPassword}
        errors={errors.password}
      />

      <div className="flex items-center gap-3">
        <Submit label="Create portal login" />
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

/** Set a new password for an existing portal login. */
export function ResetPortalPassword({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, formAction] = useActionState<FormState, FormData>(resetPortalPasswordAction, {});

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setPassword(generatePassword());
          setOpen(true);
        }}
        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Reset password
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-3 pt-3">
      <input type="hidden" name="userId" value={userId} />
      <FormError message={state.error} />
      <PasswordField
        id={`reset-${userId}`}
        label="New password"
        value={password}
        onChange={setPassword}
        errors={state.fieldErrors?.password}
      />
      <div className="flex items-center gap-3">
        <Submit label="Save password" />
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
