import "server-only";

import { prisma } from "@/lib/db";
import { openRegistrationEnabled } from "@/lib/env";

/**
 * Whether /register will accept a sign-up.
 *
 * Self-registration exists only to create the very first admin. Once a staff
 * account exists the route closes, because an open form would hand anyone on the
 * internet a MEMBER account with access to every client record. Further
 * teammates are added by an admin from /team.
 *
 * ALLOW_OPEN_REGISTRATION=true reopens it for local development; the boot-time
 * environment check refuses to start with it set in production.
 */
export async function registrationOpen(): Promise<boolean> {
  if (openRegistrationEnabled()) return true;
  const staffCount = await prisma.user.count({ where: { role: { not: "CLIENT" } } });
  return staffCount === 0;
}
