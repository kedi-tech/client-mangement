"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordInput } from "@/components/password-input";
import { Button, Field, FormError, Input, controlClass } from "@/components/ui";
import { loginAction } from "@/server/actions/auth";
import type { FormState } from "@/lib/validation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full py-[9px] text-[14px] font-medium" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <FormError message={state.error} />

      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" errors={state.fieldErrors?.password}>
        <PasswordInput
          className={controlClass()}
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
