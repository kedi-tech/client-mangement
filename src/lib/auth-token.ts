import { SignJWT, jwtVerify } from "jose";

// Kept free of any Node-only or Prisma imports so the Edge middleware can use it.

export const SESSION_COOKIE = "cm_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  /** Present only for CLIENT accounts: the client this login may see. */
  clientId?: string | null;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Copy .env.example to .env and set a value of at least 32 characters.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    return {
      userId: payload.userId,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "",
      role: typeof payload.role === "string" ? payload.role : "MEMBER",
      clientId: typeof payload.clientId === "string" ? payload.clientId : null,
    };
  } catch {
    return null;
  }
}

/** Portal accounts are confined to /portal; everyone else works in the admin app. */
export function isPortalRole(role: string): boolean {
  return role === "CLIENT";
}

/** Where a signed-in user belongs after login or a stray navigation. */
export function homePathFor(role: string): string {
  return isPortalRole(role) ? "/portal" : "/dashboard";
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;
