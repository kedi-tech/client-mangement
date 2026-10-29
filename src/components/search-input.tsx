"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

/**
 * Debounced search box that pushes the query into the URL, so results stay
 * server-rendered, shareable and back-button friendly.
 */
export function SearchInput({
  placeholder = "Search…",
  paramName = "q",
  basePath,
  autoFocus,
  large = false,
  className,
}: {
  placeholder?: string;
  paramName?: string;
  basePath?: string;
  autoFocus?: boolean;
  /** The big box on the Search page. */
  large?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");

  useEffect(() => {
    // Only navigate when the typed text differs from what the URL already says.
    // Other URL changes (Next/Previous page, a filter) also re-run this effect,
    // and must not reset the page back to 1.
    if (value.trim() === (searchParams.get(paramName) ?? "")) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(paramName, value.trim());
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      const path = basePath ?? window.location.pathname;
      const query = params.toString();
      router.replace(query ? `${path}?${query}` : path);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, paramName, basePath, router, searchParams]);

  return (
    <input
      type="search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      autoFocus={autoFocus}
      className={cn(
        "min-w-0 border border-inpb bg-inp text-tx",
        large ? "rounded-[6px] px-3 py-2.5 text-[15px]" : "rounded-[4px] px-2.5 py-[7px] text-[13px]",
        className ?? "flex-[1_1_260px]",
      )}
    />
  );
}
