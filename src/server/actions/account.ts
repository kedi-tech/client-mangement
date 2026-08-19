"use server";

import { prisma } from "@/lib/db";
import { describeRetryAfter } from "@/lib/format";
import {
  checkLoginThrottle,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from "@/lib/rate-limit";
import {
  createSession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/session";
import { changePasswordSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

/**
 * Let a signed-in account change its own password.
 *
 * Works for any role: a portal client managing their own login, and staff doing
 * the same. Admins resetting *someone else's* password is a different thing and
 * lives in `team.ts` / `portal-access.ts`.
 */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  // The current password is a guessable secret, so this form is throttled on the
  // same counters as sign-in — otherwise it would be an unlimited oracle for
  // anyone who got hold of a session cookie.
  const ip = await clientIp();
  const throttle = await checkLoginThrottle(user.email, ip);
  if (throttle.blocked) {
    return {
      error: `Too many attempts. Try again in ${describeRetryAfter(throttle.retryAfterSeconds)}.`,
    };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!account) return { error: "Your session has expired. Sign in again." };

  if (!(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
    await recordLoginFailure(user.email, ip);
    return { fieldErrors: { currentPassword: ["That is not your current password."] } };
  }

  await clearLoginFailures(user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      // Signs every *other* device out. The whole point of changing a password
      // is usually that someone else may know the old one.
      sessionsValidFrom: new Date(),
    },
  });

  // ...which would sign this device out too, since the cookie in hand predates
  // the bump. Issue a fresh one so the person who just changed their password
  // stays where they are.
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
  });

  await logActivity({
    type: user.role === "CLIENT" ? "PORTAL_PASSWORD_CHANGED" : "STAFF_PASSWORD_CHANGED",
    message: `${user.email} changed their own password`,
    actorId: user.id,
    clientId: user.clientId,
    entityType: "User",
    entityId: user.id,
  });

  return { ok: true };
}
