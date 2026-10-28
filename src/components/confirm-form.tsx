"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass } from "@/components/ui";

function ConfirmSubmit({
  children,
  className,
  confirmMessage,
}: {
  children: ReactNode;
  className?: string;
  confirmMessage: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={className}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/**
 * Destructive action wrapped in a native confirm. `hidden` carries the record id
 * so the server action stays a plain FormData handler.
 */
export function ConfirmForm({
  action,
  hidden,
  confirmMessage,
  children,
  className,
  variant = "danger",
  buttonTextClass,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  confirmMessage: string;
  children: ReactNode;
  className?: string;
  /** `danger` is an outlined button; `subtle` is a red text link. */
  variant?: "danger" | "subtle";
  /** Extra classes for the button, e.g. a smaller font or tighter padding. */
  buttonTextClass?: string;
}) {
  return (
    <form action={action} className={className}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmSubmit
        confirmMessage={confirmMessage}
        className={
          variant === "danger"
            ? buttonClass("danger", "sm", buttonTextClass ?? "px-2.5 py-[5px]")
            : buttonClass("linkDanger", "sm", buttonTextClass)
        }
      >
        {children}
      </ConfirmSubmit>
    </form>
  );
}
