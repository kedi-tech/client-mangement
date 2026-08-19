import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { PortalNav } from "@/components/portal-nav";
import { Avatar } from "@/components/ui";
import { prisma } from "@/lib/db";
import { initials } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { logoutAction } from "@/server/actions/auth";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requirePortalUser();
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, owner: { select: { name: true, email: true } } },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2">
            <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            priority
            unoptimized
            className="size-8 shrink-0 rounded-lg bg-white ring-1 ring-slate-200 dark:ring-slate-700"
          />
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {client?.name ?? "Client portal"}
            </span>
          </Link>

          <div className="flex items-center gap-3">
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
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <PortalNav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        <p className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {client?.owner
            ? `Questions? Your account manager is ${client.owner.name} (${client.owner.email}).`
            : "Questions? Reply to your latest email from us and we'll pick it up."}
        </p>
      </footer>
    </div>
  );
}
