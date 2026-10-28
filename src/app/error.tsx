"use client";

import { useEffect } from "react";

import { buttonClass } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="flex w-full max-w-[520px] flex-col items-start gap-3">
        <h1 className="m-0 text-[24px] font-semibold">Something went wrong</h1>
        <div className="box-border w-full rounded-[4px] border border-ln bg-hov px-3 py-2.5 font-mono text-[12.5px] text-mu">
          {error.message || "An unexpected error occurred while loading this page."}
        </div>
        <button type="button" onClick={reset} className={buttonClass("primary", "lg")}>
          Try again
        </button>
      </div>
    </div>
  );
}
