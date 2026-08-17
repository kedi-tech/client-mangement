"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input } from "@/components/ui";
import { registerAction } from "@/server/actions/auth";
import type { FormState } from "@/lib/validation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<FormState, FormData>(registerAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="Full name" htmlFor="name" errors={state.fieldErrors?.name} required>
        <Input id="name" name="name" autoComplete="name" required placeholder="Jordan Reyes" />
      </Field>

      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        errors={state.fieldErrors?.password}
        hint="At least 8 characters."
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        errors={state.fieldErrors?.confirmPassword}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
