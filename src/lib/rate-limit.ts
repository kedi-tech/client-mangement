import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * Throttling for sign-in attempts.
 *
 * Counters live in the database rather than in process memory so they survive a
 * restart and stay shared if the app is ever run as more than one container.
 * Failures are counted against two keys at once:
 *
 *   - the submitted email, which stops one account being brute forced, and
 *   - the caller's IP, which stops a spray across many accounts.
 *
 * Rows older than the window are pruned on each check, so no scheduled job is
 * needed to keep the table small.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 10;
const MAX_FAILURES_PER_IP = 30;

export type ThrottleVerdict =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number };

/**
 * The caller's IP address.
 *
 * Behind a reverse proxy this reads `X-Forwarded-For`, which a client can forge
 * unless the proxy overwrites it — see the deployment notes in README.md. The
 * per-email limit does not depend on it, so a forged header still cannot brute
 * force a single account.
 */
export async function clientIp(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return store.get("x-real-ip")?.trim() || "unknown";
}

const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;
const ipKey = (ip: string) => `ip:${ip}`;

/** True when this email or IP has failed too often inside the window. */
export async function checkLoginThrottle(email: string, ip: string): Promise<ThrottleVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);

  // Cheap opportunistic cleanup; the index on createdAt keeps it fast.
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: since } } });

  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { key: emailKey(email), createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loginAttempt.count({ where: { key: ipKey(ip), createdAt: { gte: since } } }),
  ]);

  const overEmail = emailFailures.length >= MAX_FAILURES_PER_EMAIL;
  const overIp = ipFailures >= MAX_FAILURES_PER_IP;
  if (!overEmail && !overIp) return { blocked: false };

  // The block lifts when the oldest counted failure ages out of the window.
  const oldest = emailFailures[0]?.createdAt.getTime() ?? Date.now();
  const retryAfterMs = Math.max(1000, oldest + WINDOW_MS - Date.now());
  return { blocked: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.createMany({
    data: [{ key: emailKey(email) }, { key: ipKey(ip) }],
  });
}

/** A successful sign-in clears that account's failures so it is not left near the limit. */
export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: emailKey(email) } });
}
