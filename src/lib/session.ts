import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  isPortalRole,
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
    select: { id: true, email: true, name: true, role: true, clientId: true },
  });
  return user;
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
