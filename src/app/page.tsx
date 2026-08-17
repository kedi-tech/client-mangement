import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth-token";
import { getCurrentUser } from "@/lib/session";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user.role) : "/login");
}
