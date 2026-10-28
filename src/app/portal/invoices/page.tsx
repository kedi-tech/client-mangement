import type { Metadata } from "next";
import Link from "next/link";

import { PortalCard, PortalHero, PortalMain, PortalPill } from "@/components/portal-ui";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { getPortalOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Invoices" };

const COLS = "110px minmax(140px,1fr) 100px 120px 120px 120px";

export default async function PortalInvoicesPage() {
  const user = await requirePortalUser();
  const { invoices, totals } = await getPortalOverview(user.clientId);

  return (
    <>
      <PortalHero
        title="Invoices"
        sub={
          totals.outstandingCents > 0
            ? `${formatMoney(totals.outstandingCents)} outstanding`
            : "Everything is settled"
        }
      />
      <PortalMain>
        {invoices.length === 0 ? (
          <PortalCard raised className="px-[22px] py-10 text-center text-[14px] text-mu">
            No invoices yet.
          </PortalCard>
        ) : (
          <div className="overflow-hidden rounded-[20px] bg-card shadow-soft">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div
                  className="grid gap-3 px-[22px] pt-4 pb-2.5 text-[12px] text-fa"
                  style={{ gridTemplateColumns: COLS }}
                >
                  <span>Invoice</span>
                  <span>Project</span>
                  <span>Status</span>
                  <span>Issued</span>
                  <span>Due</span>
                  <span className="text-right">Amount</span>
                </div>
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/portal/invoices/${invoice.id}`}
                    className="grid items-center gap-3 border-t border-ln px-[22px] py-3 text-[14px] text-tx hover:bg-chip hover:text-tx"
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <span className="font-medium">{invoice.number}</span>
                    <span className="truncate text-mu">{invoice.project?.name ?? "—"}</span>
                    <span>
                      <PortalPill value={invoice.effectiveStatus} small />
                    </span>
                    <span className="text-[13px] text-mu">{formatDate(invoice.issueDate)}</span>
                    <span className="text-[13px] text-mu">{formatDate(invoice.dueDate)}</span>
                    <span className="text-right">{formatMoney(invoice.totals.totalCents)}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex justify-between border-t border-ln px-[22px] py-3.5 text-[13.5px] text-mu">
              <span>{plural(invoices.length, "invoice")}</span>
              <span>
                Outstanding <strong className="font-semibold text-tx">{formatMoney(totals.outstandingCents)}</strong>
              </span>
            </div>
          </div>
        )}
      </PortalMain>
    </>
  );
}
