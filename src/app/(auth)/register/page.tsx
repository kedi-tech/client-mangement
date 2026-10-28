import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth-token";
import { getCurrentUser } from "@/lib/session";
import { registrationOpen } from "@/server/registration";
import { AuthCard, AuthHeading } from "../auth-card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  // Sign-up only bootstraps the first admin; after that an admin adds teammates
  // from /team, so the form is not offered at all.
  if (!(await registrationOpen())) {
    return (
      <AuthCard>
        <h1 className="m-0 text-[20px] font-semibold">Sign-up is closed</h1>
        <p className="m-0 text-[13.5px] leading-[1.55] text-mu">
          This workspace already has an administrator. Ask them to add you as a teammate, then sign
          in with the details they send you.
        </p>
        <Link href="/login" className="text-[13.5px]">
          ← Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeading
        title="Set up your workspace"
        subtitle="The first account created becomes the workspace admin."
      />
      <RegisterForm />
    </AuthCard>
  );
}
