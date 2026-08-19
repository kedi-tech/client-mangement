"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { label } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import {
  createTeamMemberAction,
  resetTeamPasswordAction,
  updateTeamRoleAction,
} from "@/server/actions/team";

/** Readable, reasonably strong temporary password to hand to a teammate. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function Submit({ label: text }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : text}
    </Button>
  );
}

function PasswordField({
  id,
  label: fieldLabel,
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
      label={fieldLabel}
      htmlFor={id}
      errors={errors}
      hint="Send this over a channel you trust. Setting a password signs the account out of every device."
      required
    >
      <div className="flex flex-wrap gap-2">
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
          className="min-w-0 flex-1 font-mono"
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => onChange(generatePassword())}
        >
          Generate
        </Button>
      </div>
    </Field>
  );
}

/** Add a staff account. Self sign-up is closed, so this is the only way in. */
export function AddTeamMember({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, formAction] = useActionState<FormState, FormData>(createTeamMemberAction, {});
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
      <Button
        type="button"
        onClick={() => {
          setPassword(generatePassword());
          setOpen(true);
        }}
      >
        Add teammate
      </Button>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 w-full space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30"
    >
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="teamName" errors={errors.name} required>
          <Input id="teamName" name="name" required autoComplete="off" />
        </Field>

        <Field label="Email" htmlFor="teamEmail" errors={errors.email} required>
          <Input id="teamEmail" name="email" type="email" required autoComplete="off" />
        </Field>
      </div>

      <Field
        label="Role"
        htmlFor="teamRole"
        errors={errors.role}
        hint="Admins can add and remove members. Members have full access to client data but cannot change accounts."
        required
      >
        <Select id="teamRole" name="role" defaultValue="MEMBER">
          {roles.map((role) => (
            <option key={role} value={role}>
              {label(role)}
            </option>
          ))}
        </Select>
      </Field>

      <PasswordField
        id="teamPassword"
        label="Temporary password"
        value={password}
        onChange={setPassword}
        errors={errors.password}
      />

      <div className="flex items-center gap-3">
        <Submit label="Create account" />
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

/** Inline role switcher. Submits on change so there is no extra save button. */
export function RoleSelect({
  userId,
  role,
  roles,
}: {
  userId: string;
  role: string;
  /** Roles the signed-in actor may assign; the current one is always included. */
  roles: string[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateTeamRoleAction, {});

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Select
        name="role"
        defaultValue={role}
        aria-label="Role"
        className="w-36 py-1 text-xs"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {(roles.includes(role) ? roles : [role, ...roles]).map((value) => (
          <option key={value} value={value}>
            {label(value)}
          </option>
        ))}
      </Select>
      {state.error ? (
        <span className="text-xs font-medium text-rose-600 dark:text-rose-400">{state.error}</span>
      ) : null}
    </form>
  );
}

/** Set a new password for a teammate who has lost theirs. */
export function ResetTeamPassword({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, formAction] = useActionState<FormState, FormData>(resetTeamPasswordAction, {});

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
        id={`team-reset-${userId}`}
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
