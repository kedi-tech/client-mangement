import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { SERVICE_KIND_LABELS, label, toneFor } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { RENEWAL_COLOR, renewalStatus } from "@/lib/services";

/*
 * Client portal kit — design direction 1f ("soft"): a blue band behind the page
 * title, rounded 20px cards that overlap it, filled pastel pills and thick
 * progress tracks. Colours come from the `.portal` tokens in globals.css.
 */

/** Rounded card. `raised` adds the soft shadow used on the primary cards. */
export function PortalCard({
  raised = false,
  className,
  children,
}: {
  raised?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-[20px] bg-card p-[22px]", raised && "shadow-soft", className)}>
      {children}
    </div>
  );
}

export function PortalH2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("m-0 mb-2 text-[17px] font-semibold", className)}>{children}</h2>;
}

/** Card heading with a link on the right ("All invoices"). */
export function PortalCardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="m-0 text-[17px] font-semibold">{title}</h2>
      {action ? <span className="text-[13px]">{action}</span> : null}
    </div>
  );
}

/** Filled status pill. */
export function PortalPill({ value, small = false }: { value: string; small?: boolean }) {
  const tone = toneFor(value);
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        small ? "py-[3px]" : "py-1",
      )}
      style={{ background: `var(--${tone}-b)`, color: `var(--${tone}-f)` }}
    >
      {label(value)}
    </span>
  );
}

export function PortalProgress({ percent, height = 10 }: { percent: number; height?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="rounded-full bg-track"
      style={{ height }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="rounded-full bg-fill" style={{ height, width: `${clamped}%` }} />
    </div>
  );
}

/** Key/value row in a portal details card. */
export function PortalDetail({
  term,
  children,
  border = "top",
}: {
  term: string;
  children: ReactNode;
  border?: "top" | "bottom";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 py-[9px] text-[13.5px]",
        border === "top" ? "border-t border-ln" : "border-b border-ln",
      )}
    >
      <span className="text-mu">{term}</span>
      <span className="min-w-0 text-right [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** Muted line shown when a card's list is empty. */
export function PortalEmpty({ children, bordered = true }: { children: ReactNode; bordered?: boolean }) {
  return (
    <div className={cn("pt-3.5 pb-2.5 text-[14px] text-mu", bordered && "border-t border-ln")}>{children}</div>
  );
}

/**
 * The page title area. It sits inside the blue band that the layout starts, so
 * the cards rendered in <PortalMain> can overlap the band's lower edge.
 */
export function PortalHero({
  title,
  sub,
  crumb,
  action,
}: {
  title: string;
  sub?: string;
  crumb?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <div className="bg-band pb-[84px] text-white min-[720px]:pb-24">
      <div className="mx-auto box-border flex max-w-[1080px] flex-wrap items-center justify-between gap-3.5 px-4 pt-[30px] min-[720px]:px-8">
        <div className="min-w-0">
          {crumb ? (
            <Link
              href={crumb.href}
              className="mb-1.5 inline-block text-[13px] text-white/85 hover:text-white"
            >
              ← {crumb.label}
            </Link>
          ) : null}
          <h1 className="m-0 text-[26px] font-semibold tracking-[-.01em] min-[720px]:text-[34px]">{title}</h1>
          {sub ? <div className="mt-1 text-[14px] text-white/85">{sub}</div> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

/** Content column that pulls up over the band. */
export function PortalMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto -mt-16 box-border flex w-full max-w-[1080px] flex-1 flex-col gap-4 px-4 pb-8 min-[720px]:px-8">
      {children}
    </main>
  );
}

/** White pill button that sits on the band ("Send us a file"). */
export function BandButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-[14px] bg-white px-5 py-[11px] text-[14px] font-medium whitespace-nowrap text-[#2c46b0] hover:text-[#2c46b0]"
    >
      {children}
    </Link>
  );
}

/** White pill status badge on the band (project and invoice pages). */
export function BandBadge({ value }: { value: string }) {
  const color = value === "OVERDUE" ? "#9c2534" : value === "PAID" ? "#1f6a3f" : "#2c46b0";
  return (
    <span className="rounded-full bg-white px-3 py-[5px] text-[13px] font-medium" style={{ color }}>
      {label(value)}
    </span>
  );
}

/** Primary portal button style (rounded 14px). */
export const portalButtonClass =
  "rounded-[14px] border-0 bg-ac px-[18px] py-2.5 text-[14px] font-medium text-white hover:text-white disabled:opacity-60";

/** Domain and hosting rows in the portal (read-only; notes stay internal). */
export function PortalServiceList({
  services,
}: {
  services: {
    id: string;
    kind: string;
    name: string;
    providedBy: string;
    provider: string | null;
    renewsAt: Date | null;
    priceCents: number;
    project?: { id: string; name: string } | null;
  }[];
}) {
  return (
    <>
      {services.map((service) => {
        const renewal = renewalStatus(service.renewsAt);
        return (
          <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-ln py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">{service.name}</div>
              <div className="text-[12.5px] text-fa">
                {SERVICE_KIND_LABELS[service.kind]}
                {service.provider ? ` · ${service.provider}` : ""}
                {" · "}
                {service.providedBy === "US" ? "Managed by us" : "Provided by you"}
                {service.project ? (
                  <>
                    {" · "}
                    <Link href={`/portal/projects/${service.project.id}`}>{service.project.name}</Link>
                  </>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-[12.5px]", RENEWAL_COLOR[renewal.state])}>{renewal.label}</div>
              {service.providedBy === "US" && service.priceCents > 0 ? (
                <div className="text-[12px] text-fa">{formatMoney(service.priceCents)} per renewal</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
