"use client";

import { useState, type ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Password field with a Show/Hide button, so people can check what they typed.
 * Pass the input's own styling through `className`; the button sits inside the
 * right edge of the field.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={cn(className, "w-full pr-16")} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 border-0 bg-transparent px-3 text-[12px] font-medium text-mu hover:text-tx"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
