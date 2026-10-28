"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { STAFF_ROLES, canManageRole, isAdminRole } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { forgetUser, hashPassword, requireAdmin, revokeSessionsFor } from "@/lib/session";
import { toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

/**
 * Staff account administration.
 *
 * Self-registration closes once the first admin exists, so this is how teammates
 * are added. Reaching these actions needs ADMIN or SUPER_ADMIN, and each one
 * then checks rank per target: you may only act on someone strictly below you.
 */

const staffRole = z.enum(STAFF_ROLES);

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: staffRole,
});

/**
 * Accounts that can still reach /team. Used to refuse the last demotion or
 * removal that would leave nobody able to administer the workspace.
 */
async function adminCount(): Promise<number> {
  return prisma.user.count({ where: { role: { in: STAFF_ROLES.filter(isAdminRole) } } });
}

/** Refuses any target the actor outranks — see `canManageRole`. */
const OUT_OF_RANGE: FormState = {
  error: "You do not have permission to change that account.",
};

/**
 * Every admin is also one of the workspace owner's clients. When an account
 * becomes ADMIN — added that way, or promoted — and is not linked to a client
 * yet, a client record is created for them, owned by whoever made them admin,
 * with them as the primary contact. Their account is linked to it, so they can
 * also open that client's portal alongside the admin app.
 */
async function makeAdminAClient(
  actorId: string,
  account: { id: string; name: string; email: string; clientId: string | null },
): Promise<void> {
  if (account.clientId) return;

  const [firstName, ...rest] = account.name.trim().split(/\s+/);
  const client = await prisma.client.create({
    data: {
      name: account.name,
      email: account.email,
      status: "ACTIVE",
      ownerId: actorId,
      contacts: {
        create: {
          firstName: firstName || account.name,
          lastName: rest.join(" ") || "-",
          email: account.email,
          isPrimary: true,
        },
      },
    },
  });
  await prisma.user.update({ where: { id: account.id }, data: { clientId: client.id } });
  forgetUser(account.id);

  await logActivity({
    type: "CLIENT_CREATED",
    message: `${client.name} was added as a client (new admin)`,
    actorId,
    clientId: client.id,
    entityType: "Client",
    entityId: client.id,
  });
  await logActivity({
    type: "PORTAL_ACCESS_GRANTED",
    message: `Portal access granted to ${account.email} for ${client.name}`,
    actorId,
    clientId: client.id,
    entityType: "User",
    entityId: account.id,
  });
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

/** Look up a staff account by id. Portal logins are managed from the client page. */
async function findStaff(id: string) {
  return prisma.user.findFirst({
    where: { id, role: { in: [...STAFF_ROLES] } },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function createTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  // An admin may create members but not other admins, so they can never mint a
  // peer they would then be unable to manage. Re-checked here because the form
  // only *renders* the permitted options.
  if (!canManageRole(admin.role, parsed.data.role)) return OUT_OF_RANGE;

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { fieldErrors: { email: ["That email already has an account."] } };

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });

  await logActivity({
    type: "TEAM_MEMBER_ADDED",
    message: `${created.email} was added to the team as ${parsed.data.role.toLowerCase()}`,
    actorId: admin.id,
    entityType: "User",
    entityId: created.id,
  });

  if (created.role === "ADMIN") await makeAdminAClient(admin.id, created);

  revalidatePath("/team");
  return { ok: true };
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: staffRole,
});

export async function updateTeamRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const target = await findStaff(parsed.data.userId);
  if (!target) return { error: "That account no longer exists." };
  if (target.role === parsed.data.role) return { ok: true };

  // Both ends are checked: the actor must outrank who they are changing *and*
  // the role they are moving them to. Without the second test an admin could
  // promote a member to admin, or to super admin.
  if (!canManageRole(admin.role, target.role)) return OUT_OF_RANGE;
  if (!canManageRole(admin.role, parsed.data.role)) return OUT_OF_RANGE;

  if (isAdminRole(target.role) && (await adminCount()) <= 1) {
    return { error: "This is the only administrator. Promote someone else first." };
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });
  if (updated.role === "ADMIN") await makeAdminAClient(admin.id, updated);
  // The role is carried in the session token, so old cookies must stop working
  // or a demoted admin would keep their old permissions until the JWT expired.
  await revokeSessionsFor(target.id);

  await logActivity({
    type: "TEAM_ROLE_CHANGED",
    message: `${target.email} is now ${parsed.data.role.toLowerCase()}`,
    actorId: admin.id,
    entityType: "User",
    entityId: target.id,
  });

  revalidatePath("/team");
  return { ok: true };
}

const passwordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetTeamPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = passwordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const target = await findStaff(parsed.data.userId);
  if (!target) return { error: "That account no longer exists." };

  // Setting someone's password is taking over their account, so it needs the
  // same rank as any other change.
  if (!canManageRole(admin.role, target.role)) return OUT_OF_RANGE;

  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      // Signs the account out everywhere; the point of a reset is usually that
      // the old credential is no longer trusted.
      sessionsValidFrom: new Date(),
    },
  });

  forgetUser(target.id);

  await logActivity({
    type: "TEAM_PASSWORD_RESET",
    message: `Password reset for ${target.email}`,
    actorId: admin.id,
    entityType: "User",
    entityId: target.id,
  });

  revalidatePath("/team");
  return { ok: true };
}

/** Remove a teammate. Their authored notes and activity survive with a null author. */
export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const target = await findStaff(String(formData.get("userId") ?? ""));
  if (!target) return;

  // Rank already rules out removing yourself or anyone at or above you — the
  // super admin included, which is what keeps the workspace recoverable.
  if (!canManageRole(admin.role, target.role)) return;
  if (isAdminRole(target.role) && (await adminCount()) <= 1) return;

  await prisma.user.delete({ where: { id: target.id } });
  forgetUser(target.id);

  await logActivity({
    type: "TEAM_MEMBER_REMOVED",
    message: `${target.email} was removed from the team`,
    actorId: admin.id,
    entityType: "User",
    entityId: target.id,
  });

  revalidatePath("/team");
}
