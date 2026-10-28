import type { Metadata } from "next";

import { Card, PageHeader } from "@/components/ui";
import {
  STAFF_ROLES,
  assignableRolesFor,
  canManageRole,
  isAdminRole,
  isSuperAdmin,
  roleRank,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { TeamPanel, type TeamRow } from "./team-panels";

export const metadata: Metadata = { title: "Team" };

/**
 * Staff account administration, admin-only.
 *
 * Self sign-up closes once the first admin exists — an open /register would give
 * anyone on the internet access to every client record — so teammates are
 * created here instead.
 */
export default async function TeamPage() {
  const admin = await requireAdmin();

  const staff = await prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  // Counted over *every* staff account, including any hidden below, so the
  // "only administrator" guard stays correct even when the list is filtered.
  const adminCount = staff.filter((member) => isAdminRole(member.role)).length;

  // The super admin is not shown to anyone else — an admin has no action they
  // could take on that row, so listing it only exposes the owner's identity.
  // The server actions refuse the same changes regardless; this is presentation.
  const members = isSuperAdmin(admin.role)
    ? staff
    : staff.filter((member) => !isSuperAdmin(member.role));

  // Most privileged first. Sorted here rather than in SQL because the column
  // holds strings, and alphabetical order would put SUPER_ADMIN after MEMBER.
  members.sort((a, b) => roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name));

  // What this actor is allowed to hand out — an admin sees only "Member".
  const assignable = assignableRolesFor(admin.role);

  const rows: TeamRow[] = members.map((member) => {
    const isSelf = member.id === admin.id;
    const isLastAdmin = isAdminRole(member.role) && adminCount <= 1;
    // Rank already excludes yourself, your peers and the super admin.
    const outranked = canManageRole(admin.role, member.role);
    const manageable = outranked && !isLastAdmin;
    const reason = isSelf
      ? "Your own account"
      : isSuperAdmin(member.role)
        ? "Workspace owner"
        : !outranked
          ? "Outranks you"
          : isLastAdmin
            ? "Only administrator"
            : "";

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      isSelf,
      canChange: manageable,
      canReset: outranked,
      canRemove: manageable,
      reason,
      lastSeen: member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never",
      added: formatDateTime(member.createdAt),
    };
  });

  return (
    <>
      <PageHeader
        title="Team"
        description="You can only change accounts ranked below your own. Client portal logins are managed on each client's page."
      />
      <Card>
        <TeamPanel rows={rows} assignable={assignable} />
      </Card>
    </>
  );
}
