"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

import { LogoLockup } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/server/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/contacts", label: "Contacts" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/invoices", label: "Invoices" },
  { href: "/files", label: "Files" },
  { href: "/reports", label: "Reports" },
];

const ADMIN_NAV = [{ href: "/team", label: "Team" }];
const SUPER_ADMIN_NAV = [{ href: "/oversight", label: "Oversight" }];

function Brand() {
  return <LogoLockup className="text-white" />;
}

function NavLinks({
  items,
  pathname,
  large = false,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  pathname: string;
  large?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-px">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-[4px] px-2",
              large ? "py-[9px] text-[14px]" : "py-1.5 text-[13px]",
              active
                ? "bg-raila font-medium text-white hover:text-white"
                : "text-railtx hover:bg-raila/60 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RailFooter({ name, email }: { name: string; email: string }) {
  return (
    <div className="mt-auto border-t border-[#262b33] px-2 pt-2.5 text-[11.5px] leading-normal text-[#8a919c]">
      <div className="text-[#e6e9ee]">{name}</div>
      <div className="truncate">{email}</div>
    </div>
  );
}

/**
 * The admin shell from design 1b: a dark 208px rail beside a 48px top bar.
 * Below 900px the rail becomes a drawer opened from a "Menu" button.
 *
 * Hiding a link is presentation only — each page enforces its own role.
 */
export function AppShell({
  userName,
  userEmail,
  isAdmin = false,
  isSuperAdmin = false,
  theme,
  hasPortal = false,
  children,
}: {
  userName: string;
  userEmail: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  theme: "light" | "dark";
  /** This staff member is also one of our clients and can open their portal. */
  hasPortal?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  const items = [...NAV, ...(isAdmin ? ADMIN_NAV : []), ...(isSuperAdmin ? SUPER_ADMIN_NAV : [])];

  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-5 bg-rail px-3 py-4 text-railtx min-[900px]:flex">
        <Link href="/dashboard" className="px-1.5 py-1 hover:text-white">
          <Brand />
        </Link>
        <NavLinks items={items} pathname={pathname} />
        <RailFooter name={userName} email={userEmail} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-[5] flex h-12 items-center gap-3 border-b border-ln bg-pn px-3 text-[13px] min-[720px]:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-[4px] border border-inpb bg-pn px-2.5 py-[5px] text-[12.5px] min-[900px]:hidden"
            aria-expanded={open}
          >
            Menu
          </button>
          <span className="min-[900px]:hidden">
            <LogoLockup className="text-tx" />
          </span>
          <Link
            href="/search"
            className="hidden max-w-[360px] flex-1 rounded-[4px] border border-ln bg-hov px-2.5 py-1.5 text-fa hover:text-mu min-[720px]:block"
          >
            Search everything
          </Link>
          {hasPortal ? (
            <Link
              href="/portal"
              className="ml-auto rounded-[4px] border border-ln px-[9px] py-1 text-[12px] whitespace-nowrap text-mu hover:text-tx"
            >
              Client portal
            </Link>
          ) : null}
          <ThemeToggle
            initial={theme}
            className={cn(
              "rounded-[4px] border border-ln bg-transparent px-[9px] py-1 text-[12px] text-mu",
              hasPortal ? "ml-0" : "ml-auto",
            )}
          />
          <span className="hidden min-[720px]:inline">{userName}</span>
          <form action={logoutAction}>
            <button type="submit" className="border-0 bg-transparent p-0 text-mu hover:text-tx">
              Sign out
            </button>
          </form>
        </header>

        <main className="box-border flex w-full max-w-[1400px] flex-col gap-4 p-3.5 min-[720px]:px-6 min-[720px]:py-5">
          {children}
        </main>
      </div>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-20 bg-[rgba(10,12,16,.45)]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-[21] box-border flex w-[260px] flex-col gap-5 bg-rail px-3 py-4 text-railtx shadow-soft">
            <div className="flex items-center justify-between px-1.5 py-1">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[4px] border border-[#3a404a] bg-transparent px-2 py-[3px] text-[12px] text-[#c9ced6]"
              >
                Close
              </button>
            </div>
            <NavLinks items={items} pathname={pathname} large onNavigate={() => setOpen(false)} />
            <RailFooter name={userName} email={userEmail} />
          </aside>
        </>
      ) : null}
    </div>
  );
}
