"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { PasswordInput } from "@/components/password-input";
import { portalButtonClass } from "@/components/portal-ui";
import type { FormState } from "@/lib/validation";
import { changePasswordAction } from "@/server/actions/account";

const inputClass = "rounded-[12px] border border-inpb bg-inp px-3 py-[9px] text-[14px] text-tx";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${portalButtonClass} self-start`}>
      {pending ? "Saving…" : "Update password"}
    </button>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  errors,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  errors?: string[];
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-medium">
      {label}
      <PasswordInput
        id={id}
        name={name}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className={inputClass}
      />
      {errors?.length ? (
        <span className="font-normal text-red" role="alert">
          {errors[0]}
        </span>
      ) : null}
    </label>
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
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-[20px] bg-card p-[22px] shadow-soft"
    >
      <h2 className="m-0 text-[17px] font-semibold">Change password</h2>
      <div className="-mt-1 text-[13px] text-fa">Changing it signs you out on every other device.</div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-[12px] px-3.5 py-2.5 text-[13.5px]"
          style={{ background: "var(--rose-b)", color: "var(--rose-f)" }}
        >
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div
          role="status"
          className="rounded-[12px] px-3.5 py-2.5 text-[13.5px]"
          style={{ background: "var(--emerald-b)", color: "var(--emerald-f)" }}
        >
          Password changed. Your other devices were signed out.
        </div>
      ) : null}

      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        errors={errors.currentPassword}
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        errors={errors.newPassword}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        errors={errors.confirmPassword}
      />

      <Submit />
    </form>
  );
}
