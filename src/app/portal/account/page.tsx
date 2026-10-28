import type { Metadata } from "next";

import { PortalCard, PortalDetail, PortalH2, PortalHero, PortalMain } from "@/components/portal-ui";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Account" };

/**
 * Where a client manages their own login.
 *
 * Until now the only way to change a portal password was to ask staff to reset
 * it, which meant the new password travelled through someone else.
 */
export default async function PortalAccountPage() {
  const user = await requirePortalUser();

  const [account, client] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { lastLoginAt: true, createdAt: true },
    }),
    prisma.client.findUnique({
      where: { id: user.clientId },
      select: { name: true, owner: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <>
      <PortalHero title="Account" sub="Your sign-in details." />
      <PortalMain>
        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-2">
          <PortalCard raised>
            <PortalH2>Details</PortalH2>
            <PortalDetail term="Name">{user.name}</PortalDetail>
            <PortalDetail term="Email">{user.email}</PortalDetail>
            <PortalDetail term="Account">{client?.name ?? "—"}</PortalDetail>
            <PortalDetail term="Last sign-in">
              {account?.lastLoginAt ? formatDateTime(account.lastLoginAt) : "This is your first visit"}
            </PortalDetail>
            <div className="mt-3 text-[13px] leading-normal text-mu">
              {client?.owner
                ? `Need your name or email changed? Ask ${client.owner.name} (${client.owner.email}).`
                : "Need your name or email changed? Reply to your latest email from us."}
            </div>
          </PortalCard>
          <ChangePasswordForm />
        </div>
      </PortalMain>
    </>
  );
}
