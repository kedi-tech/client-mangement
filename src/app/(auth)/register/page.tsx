import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth-token";
import { getCurrentUser } from "@/lib/session";
import { registrationOpen } from "@/server/registration";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  // Sign-up only bootstraps the first admin; after that an admin adds teammates
  // from /team, so the form is not offered at all.
  if (!(await registrationOpen())) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Sign-up is closed</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This workspace already has an administrator. Ask them to create an account for you, then
          sign in with the details they send you.
        </p>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">
        The first account created becomes the workspace admin.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
