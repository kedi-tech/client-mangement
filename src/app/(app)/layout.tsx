import type { ReactNode } from "react";

import { AppShell } from "@/components/sidebar";
import { isAdminRole, isSuperAdmin } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { readTheme } from "@/lib/theme";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, theme] = await Promise.all([requireUser(), readTheme()]);

  return (
    <AppShell
      userName={user.name}
      userEmail={user.email}
      isAdmin={isAdminRole(user.role)}
      isSuperAdmin={isSuperAdmin(user.role)}
      theme={theme}
      hasPortal={Boolean(user.clientId)}
    >
      {children}
    </AppShell>
  );
}
