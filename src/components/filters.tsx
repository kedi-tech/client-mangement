"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

import { buttonClass } from "@/components/ui";

const filterClass =
  "rounded-[4px] border border-inpb bg-inp px-2 py-[7px] text-[13px] text-tx disabled:opacity-60";

/** Dropdown filter that writes its value straight into the query string. */
export function FilterSelect({
  name,
  label,
  options,
  allLabel = "All",
  compact = false,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  /** Smaller control for filters that sit inside a panel header. */
  compact?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = searchParams.get(name) ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname);
    });
  }

  return (
    <select
      aria-label={label}
      value={current}
      onChange={(event) => onChange(event.target.value)}
      disabled={pending}
      className={cn(filterClass, compact && "px-1.5 py-1 text-[12.5px]")}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Row of search box and filters above a list. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function Pagination({
  page,
  pageCount,
  total,
  noun = "result",
  nounPlural,
  searchParams,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  /** Singular noun for the count, e.g. "client". */
  noun?: string;
  nounPlural?: string;
  searchParams: Record<string, string | undefined>;
  className?: string;
}) {
  const count = `${total} ${total === 1 ? noun : (nounPlural ?? `${noun}s`)}`;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `?${query}` : "?";
  };

  const pagerClass = (disabled: boolean) =>
    buttonClass("secondary", "sm", cn("px-2.5 py-1 text-[12.5px]", disabled && "pointer-events-none opacity-40"));

  return (
    <div className={cn("flex items-center justify-between text-[12.5px] text-mu", className)}>
      <span>{pageCount > 1 ? `Page ${page} of ${pageCount} · ${count}` : count}</span>
      {pageCount > 1 ? (
        <div className="flex gap-1.5">
          <Link href={hrefFor(page - 1)} aria-disabled={page <= 1} scroll={false} className={pagerClass(page <= 1)}>
            Previous
          </Link>
          <Link
            href={hrefFor(page + 1)}
            aria-disabled={page >= pageCount}
            scroll={false}
            className={pagerClass(page >= pageCount)}
          >
            Next
          </Link>
        </div>
      ) : null}
    </div>
  );
}
