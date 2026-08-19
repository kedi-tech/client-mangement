import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui";
import { Sidebar } from "@/components/sidebar";
import { isAdminRole, isSuperAdmin } from "@/lib/constants";
import { initials } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/server/actions/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <Sidebar
        userName={user.name}
        userEmail={user.email}
        isAdmin={isAdminRole(user.role)}
        isSuperAdmin={isSuperAdmin(user.role)}
      />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
          <Link
            href="/search"
            className="hidden rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 sm:block dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Search everything
          </Link>
          <div className="flex items-center gap-2">
            <Avatar text={initials(user.name)} />
            <span className="hidden text-sm font-medium text-slate-700 sm:block dark:text-slate-200">
              {user.name}
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
