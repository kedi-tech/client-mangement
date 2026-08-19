import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth-token";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  // Point a brand new install at registration instead of a form nobody can pass.
  const hasStaff = (await prisma.user.count({ where: { role: { not: "CLIENT" } } })) > 0;
  if (!hasStaff) redirect("/register");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">
        Welcome back. Enter your credentials to continue.
      </p>

      <LoginForm />

      {/*
        No sign-up link. Accounts are created by an admin from /team, and client
        portal logins from the client's page — offering "Create one" would send
        people to a route that refuses them once the workspace has an owner.
      */}
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Trouble signing in? Ask your administrator to reset your password.
      </p>
    </div>
  );
}
