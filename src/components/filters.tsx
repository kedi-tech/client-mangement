"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";

/** Dropdown filter that writes its value straight into the query string. */
export function FilterSelect({
  name,
  label,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
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
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
        disabled={pending}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Server-rendered pagination that preserves every other query parameter. */
export function Pagination({
  page,
  pageCount,
  total,
  searchParams,
}: {
  page: number;
  pageCount: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return (
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {total} {total === 1 ? "result" : "results"}
      </div>
    );
  }

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `?${query}` : "?";
  };

  const linkClass = (disabled: boolean) =>
    clsx(
      "rounded-lg border px-3 py-1.5 text-sm font-medium",
      disabled
        ? "pointer-events-none border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600"
        : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
    );

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Page {page} of {pageCount} · {total} results
      </p>
      <div className="flex gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={page <= 1}
          className={linkClass(page <= 1)}
          scroll={false}
        >
          Previous
        </Link>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={page >= pageCount}
          className={linkClass(page >= pageCount)}
          scroll={false}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
