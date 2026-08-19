"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/session";
import { toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

const inviteSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Create a portal login for a client. The account is scoped to that client by
 * `clientId`, and `requirePortalUser()` refuses to serve anything without it.
 */
export async function createPortalUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = inviteSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true, name: true },
  });
  if (!client) return { error: "That client no longer exists." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: ["That email already has an account."] } };
  }

  const portalUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "CLIENT",
      clientId: client.id,
    },
  });

  await logActivity({
    type: "PORTAL_ACCESS_GRANTED",
    message: `Portal access granted to ${portalUser.email} for ${client.name}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "User",
    entityId: portalUser.id,
  });

  revalidatePath(`/clients/${client.id}`);
  return { ok: true };
}

const resetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPortalPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = resetSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const portalUser = await prisma.user.findFirst({
    where: { id: parsed.data.userId, role: "CLIENT" },
    select: { id: true, email: true, clientId: true },
  });
  if (!portalUser) return { error: "That portal account no longer exists." };

  await prisma.user.update({
    where: { id: portalUser.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      // A reset usually means the old password is no longer trusted, so sign the
      // account out everywhere instead of letting existing cookies run their term.
      sessionsValidFrom: new Date(),
    },
  });

  await logActivity({
    type: "PORTAL_PASSWORD_RESET",
    message: `Portal password reset for ${portalUser.email}`,
    actorId: user.id,
    clientId: portalUser.clientId,
    entityType: "User",
    entityId: portalUser.id,
  });

  revalidatePath(`/clients/${portalUser.clientId}`);
  return { ok: true };
}

/** Revoking deletes the login; the client's data is untouched. */
export async function revokePortalUserAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const userId = String(formData.get("userId") ?? "");

  const portalUser = await prisma.user.findFirst({
    where: { id: userId, role: "CLIENT" },
    select: { id: true, email: true, clientId: true },
  });
  if (!portalUser) return;

  await prisma.user.delete({ where: { id: portalUser.id } });

  await logActivity({
    type: "PORTAL_ACCESS_REVOKED",
    message: `Portal access revoked for ${portalUser.email}`,
    actorId: user.id,
    clientId: portalUser.clientId,
    entityType: "User",
    entityId: portalUser.id,
  });

  if (portalUser.clientId) revalidatePath(`/clients/${portalUser.clientId}`);
}
