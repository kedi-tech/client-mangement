"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, Input } from "@/components/ui";
import { loginAction } from "@/server/actions/auth";
import type { FormState } from "@/lib/validation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue="admin@example.com"
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Password" htmlFor="password" errors={state.fieldErrors?.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue="password123"
        />
      </Field>

      <SubmitButton />

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Demo credentials from <code>npm run db:seed</code> are pre-filled:
        admin@example.com / password123
      </p>
    </form>
  );
}
