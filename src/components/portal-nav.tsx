"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/projects", label: "Projects" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/files", label: "Files" },
  { href: "/portal/account", label: "Account" },
];

/** Pill tabs on the portal band; the active one is white. */
export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto mt-[18px] box-border flex max-w-[1080px] gap-1 overflow-x-auto px-4 text-[14px] min-[720px]:px-8">
      {LINKS.map((link) => {
        const active =
          link.href === "/portal"
            ? pathname === "/portal"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 whitespace-nowrap",
              active
                ? "bg-white font-medium text-[#2c46b0] hover:text-[#2c46b0]"
                : "text-white hover:bg-white/10 hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
