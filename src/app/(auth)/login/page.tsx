import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  // Point a brand new install at registration instead of a form nobody can pass.
  const hasUsers = (await prisma.user.count()) > 0;
  if (!hasUsers) redirect("/register");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">
        Welcome back. Enter your credentials to continue.
      </p>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Need an account?{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Create one
        </Link>
      </p>
    </div>
  );
}
