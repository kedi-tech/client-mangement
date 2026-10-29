import { centsToInput, dateToInput, formatDate, formatMoney } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead a renewal counts as "coming up". */
export const RENEWAL_WARNING_DAYS = 30;

/** Text colour per renewal state; expired is red, coming up is amber. */
export const RENEWAL_COLOR: Record<RenewalStatus["state"], string> = {
  none: "text-fa",
  ok: "text-mu",
  soon: "text-[var(--amber-f)]",
  expired: "text-red",
};

export type RenewalStatus = {
  label: string;
  /** `expired` and `soon` are drawn in warning colours. */
  state: "none" | "expired" | "soon" | "ok";
};

/** "Expired Oct 3, 2026", "Renews Nov 3, 2026 · in 5 days", "Renews Mar 1, 2027". */
export function renewalStatus(renewsAt: Date | null, now: Date = new Date()): RenewalStatus {
  if (!renewsAt) return { label: "No renewal date", state: "none" };
  const days = Math.ceil((renewsAt.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return { label: `Expired ${formatDate(renewsAt)}`, state: "expired" };
  if (days <= RENEWAL_WARNING_DAYS) {
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return { label: `Renews ${formatDate(renewsAt)} · ${when}`, state: "soon" };
  }
  return { label: `Renews ${formatDate(renewsAt)}`, state: "ok" };
}

/** Shape a Service row for the panel and summaries. */
export function toServiceRow(service: {
  id: string;
  kind: string;
  name: string;
  providedBy: string;
  provider: string | null;
  notes: string | null;
  renewsAt: Date | null;
  priceCents: number;
}) {
  const renewal = renewalStatus(service.renewsAt);
  return {
    id: service.id,
    kind: service.kind,
    name: service.name,
    providedBy: service.providedBy,
    provider: service.provider ?? "",
    notes: service.notes ?? "",
    renewsAtInput: dateToInput(service.renewsAt),
    renewalLabel: renewal.label,
    renewalState: renewal.state,
    price: service.priceCents > 0 ? formatMoney(service.priceCents) : "",
    priceInput: service.priceCents > 0 ? centsToInput(service.priceCents) : "",
  };
}
