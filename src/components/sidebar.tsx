"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/clients", label: "Clients", icon: "M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6M12 11a4 4 0 100-8 4 4 0 000 8z" },
  { href: "/contacts", label: "Contacts", icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3" },
  { href: "/projects", label: "Projects", icon: "M3 7h6l2 2h10v10H3z" },
  { href: "/tasks", label: "Tasks", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/invoices", label: "Invoices", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { href: "/files", label: "Files", icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { href: "/reports", label: "Reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            )}
          >
            <NavIcon path={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed left-4 top-3.5 z-50 rounded-lg border border-slate-300 bg-white p-2 text-slate-700 shadow-sm lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 dark:border-slate-800 dark:bg-slate-900",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            CM
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Client Management
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">{links}</div>

        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {userName}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
        </div>
      </aside>
    </>
  );
}
