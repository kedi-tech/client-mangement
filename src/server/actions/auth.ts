"use server";

import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth-token";
import { prisma } from "@/lib/db";
import { describeRetryAfter } from "@/lib/format";
import {
  checkLoginThrottle,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from "@/lib/rate-limit";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/session";
import { registrationOpen } from "@/server/registration";
import { loginSchema, registerSchema, toFieldErrors, type FormState } from "@/lib/validation";

/**
 * A real bcrypt hash (cost 10) of a random string that is not any account's
 * password. Compared against when the email is unknown so that branch costs the
 * same as a genuine check and cannot be timed to enumerate accounts.
 */
const DUMMY_PASSWORD_HASH = "$2b$10$yPzAvCdkUtm/exbqs.E3YeerJLv4PDDtsWSpYW8mev2GMrBqk2TUa";

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();

  const throttle = await checkLoginThrottle(email, ip);
  if (throttle.blocked) {
    return {
      error: `Too many failed sign-in attempts. Try again in ${describeRetryAfter(throttle.retryAfterSeconds)}.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message either way so the form does not reveal which emails exist.
  const invalid: FormState = { error: "Incorrect email or password." };
  if (!user) {
    // Spend roughly the time a real comparison would, so response timing does
    // not distinguish an unknown email from a wrong password.
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    await recordLoginFailure(email, ip);
    return invalid;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await recordLoginFailure(email, ip);
    return invalid;
  }

  await clearLoginFailures(email);

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Clients land in their portal; staff land in the admin app.
  redirect(homePathFor(user.role));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  // Re-checked here and not only on the page: the action is a public endpoint
  // that can be called directly, so the page's guard is not enough.
  if (!(await registrationOpen())) {
    return {
      error: "Sign-up is closed. Ask an administrator to create an account for you.",
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: ["That email is already registered."] } };
  }

  // The very first staff account to sign up owns the workspace. Portal logins
  // are created by staff from a client's page, so they never count here.
  const isFirstUser = (await prisma.user.count({ where: { role: { not: "CLIENT" } } })) === 0;

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: isFirstUser ? "ADMIN" : "MEMBER",
    },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: null,
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
