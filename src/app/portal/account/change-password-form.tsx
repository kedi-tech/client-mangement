"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import { changePasswordAction } from "@/server/actions/account";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Change password"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<FormState, FormData>(changePasswordAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Never leave a typed password sitting in the DOM after a successful change.
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4 px-5 py-5">
      <FormError message={state.error} />

      {state.ok ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          Password changed. You are still signed in here; any other device has been signed out.
        </p>
      ) : null}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        errors={errors.currentPassword}
        required
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        errors={errors.newPassword}
        hint="At least 8 characters. Use something you have not reused elsewhere."
        required
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        errors={errors.confirmPassword}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <Submit />
    </form>
  );
}
