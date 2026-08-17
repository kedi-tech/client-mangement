"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";

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
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  confirmMessage: string;
  children: ReactNode;
  className?: string;
  variant?: "danger" | "subtle";
}) {
  return (
    <form action={action} className={className}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmSubmit
        confirmMessage={confirmMessage}
        className={clsx(
          "inline-flex items-center rounded-lg text-sm font-medium transition-colors disabled:opacity-60",
          variant === "danger"
            ? "border border-rose-300 bg-white px-3 py-2 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
            : "px-2 py-1 text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400",
        )}
      >
        {children}
      </ConfirmSubmit>
    </form>
  );
}
