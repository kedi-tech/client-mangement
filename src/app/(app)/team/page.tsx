import type { Metadata } from "next";

import { ConfirmForm } from "@/components/confirm-form";
import { Avatar, Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import {
  STAFF_ROLES,
  assignableRolesFor,
  canManageRole,
  isAdminRole,
  isSuperAdmin,
  roleRank,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDateTime, initials } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { removeTeamMemberAction } from "@/server/actions/team";
import { AddTeamMember, ResetTeamPassword, RoleSelect } from "./team-panels";

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

  return (
    <>
      <PageHeader
        title="Team"
        description="Staff accounts with access to the admin app. You can only change accounts ranked below your own. Client portal logins are managed on each client's page."
      />

      <Card>
        <CardHeader
          title={`${members.length} ${members.length === 1 ? "teammate" : "teammates"}`}
          description="New accounts sign in with the temporary password you set here."
          action={assignable.length > 0 ? <AddTeamMember roles={assignable} /> : null}
        />

        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Last sign-in</Th>
              <Th>Added</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.id === admin.id;
              const isLastAdmin = isAdminRole(member.role) && adminCount <= 1;
              // Rank already excludes yourself, your peers and the super admin.
              const manageable = canManageRole(admin.role, member.role) && !isLastAdmin;

              return (
                <tr key={member.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar text={initials(member.name)} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {member.name}
                          {isSelf ? (
                            <span className="ml-2 text-xs font-normal text-slate-400">You</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {manageable ? (
                      <RoleSelect userId={member.id} role={member.role} roles={assignable} />
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Badge value={member.role} />
                        <span className="text-xs text-slate-400">
                          {isSuperAdmin(member.role)
                            ? "Workspace owner"
                            : isLastAdmin
                              ? "Only administrator"
                              : isSelf
                                ? "Your own account"
                                : "Outranks you"}
                        </span>
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatDateTime(member.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canManageRole(admin.role, member.role) ? (
                        <ResetTeamPassword userId={member.id} />
                      ) : null}
                      {!manageable ? null : (
                        <ConfirmForm
                          action={removeTeamMemberAction}
                          hidden={{ userId: member.id }}
                          confirmMessage={`Remove ${member.name}? They will be signed out and lose access immediately. Their notes and activity history are kept.`}
                          variant="subtle"
                        >
                          Remove
                        </ConfirmForm>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
