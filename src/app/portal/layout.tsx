import type { ReactNode } from "react";

import { PortalNav } from "@/components/portal-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";
import { initials } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { readTheme } from "@/lib/theme";
import { logoutAction } from "@/server/actions/auth";

/**
 * Client portal shell (design 1f). The layout opens the blue band with the
 * account bar and tabs; each page continues the band with <PortalHero> and then
 * lays its cards over it with <PortalMain>.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [user, theme] = await Promise.all([requirePortalUser(), readTheme()]);
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, owner: { select: { name: true, email: true } } },
  });
  const clientName = client?.name ?? "Client portal";

  return (
    <div className="portal flex min-h-screen flex-col bg-bg text-tx">
      <div className="bg-band pt-4 text-white min-[720px]:pt-[22px]">
        <div className="mx-auto box-border flex max-w-[1080px] items-center gap-3 px-4 text-[13.5px] min-[720px]:px-8">
          <span
            className="grid size-[30px] flex-none place-items-center rounded-[10px] bg-white/[.18] text-[12px] font-semibold"
            aria-hidden
          >
            {initials(clientName)}
          </span>
          <span className="truncate text-[15.5px] font-semibold">{clientName}</span>
          <span className="ml-auto hidden whitespace-nowrap min-[720px]:inline">{user.name}</span>
          <ThemeToggle
            initial={theme}
            labels={{ toDark: "Dark", toLight: "Light" }}
            className="ml-auto rounded-[12px] border-0 bg-white/[.12] px-3 py-1.5 text-[12.5px] text-white min-[720px]:ml-0"
          />
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-[12px] border-0 bg-white/[.16] px-3 py-1.5 text-[12.5px] whitespace-nowrap text-white"
            >
              Sign out
            </button>
          </form>
        </div>
        <PortalNav />
      </div>

      {children}

      <footer className="px-6 pt-[18px] pb-7 text-center text-[13px] text-mu">
        {client?.owner
          ? `Questions? Your account manager is ${client.owner.name} (${client.owner.email}).`
          : "Questions? Reply to your latest email from us and we'll pick it up."}
      </footer>
    </div>
  );
}
