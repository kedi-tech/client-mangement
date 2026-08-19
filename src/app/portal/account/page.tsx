import type { Metadata } from "next";

import { Card, CardHeader, DetailList, DetailRow, PageHeader } from "@/components/ui";
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
      <PageHeader title="Your account" description="Your sign-in details for this portal." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <DetailList>
            <DetailRow term="Name">{user.name}</DetailRow>
            <DetailRow term="Email">{user.email}</DetailRow>
            <DetailRow term="Account">{client?.name ?? "—"}</DetailRow>
            <DetailRow term="Last signed in">
              {account?.lastLoginAt ? formatDateTime(account.lastLoginAt) : "This is your first visit"}
            </DetailRow>
          </DetailList>
          <p className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {client?.owner
              ? `Need your name or email changed? Ask ${client.owner.name} (${client.owner.email}).`
              : "Need your name or email changed? Ask your account manager."}
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Change password"
            description="Changing it signs you out on every other device."
          />
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
