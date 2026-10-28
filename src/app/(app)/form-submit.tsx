"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

/** Primary submit for full-page forms; disables itself while the action runs. */
export function FormSubmit({ children, pendingLabel = "Saving…" }: { children: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
