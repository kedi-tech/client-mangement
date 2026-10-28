import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth-token";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { AuthCard, AuthHeading } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  // Point a brand new install at registration instead of a form nobody can pass.
  const hasStaff = (await prisma.user.count({ where: { role: { not: "CLIENT" } } })) > 0;
  if (!hasStaff) redirect("/register");

  return (
    <>
      <AuthCard>
        <AuthHeading title="Sign in" subtitle="Staff and clients use the same sign-in." />
        <LoginForm />
      </AuthCard>
      {/*
        No sign-up link. Accounts are created by an admin from /team, and client
        portal logins from the client's page — offering "Create one" would send
        people to a route that refuses them once the workspace has an owner.
      */}
      <div className="text-center text-[12.5px] text-mu">
        Trouble signing in? Ask your administrator to reset your password.
      </div>
    </>
  );
}
