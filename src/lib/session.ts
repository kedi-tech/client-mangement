import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { isAdminRole, isSuperAdmin } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  isPortalRole,
  isSessionRevoked,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth-token";

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId: string | null;
};

/**
 * Invalidate every session token already issued for an account. Call after any
 * change that should log the user out everywhere — a password reset, a role
 * change, or an admin revoking access.
 */
export async function revokeSessionsFor(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date() },
  });
}

/**
 * Resolve the signed-in user for the current request. Wrapped in React's `cache`
 * so the layout, the page and any server action in one render share a single
 * cookie verification and database read.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // The token is signed, but the account may have been deleted or had its role
  // changed since it was issued, so the database is the authority.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      sessionsValidFrom: true,
    },
  });
  if (!user) return null;

  // Reject tokens minted before the account's sessions were last revoked.
  if (isSessionRevoked(payload.issuedAtMs, user.sessionsValidFrom)) return null;

  const { sessionsValidFrom: _revokedAt, ...current } = user;
  return current;
});

/**
 * Guard for the admin app. Portal accounts are bounced to their own area rather
 * than being shown staff data.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPortalRole(user.role)) redirect("/portal");
  return user;
}

/**
 * Guard for account administration (/team). Both SUPER_ADMIN and ADMIN pass;
 * what each may actually change is decided per target by `canManageRole()`.
 * Members keep full access to client data — this gates accounts only.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) redirect("/dashboard");
  return user;
}

/**
 * Guard for the few actions reserved to the workspace owner. Kept separate from
 * `requireAdmin()` so a future super-admin-only screen does not have to
 * re-derive the check.
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user.role)) redirect("/dashboard");
  return user;
}

export type PortalUser = CurrentUser & { clientId: string };

/**
 * Guard for the client portal. Returns a user whose `clientId` is guaranteed —
 * every portal query must be scoped by it so one client can never read another's
 * records.
 */
export async function requirePortalUser(): Promise<PortalUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isPortalRole(user.role) || !user.clientId) redirect("/dashboard");
  return user as PortalUser;
}
