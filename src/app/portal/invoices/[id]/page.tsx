import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BandBadge, PortalCard, PortalDetail, PortalHero, PortalMain } from "@/components/portal-ui";
import { label } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { lineTotalCents } from "@/lib/invoice";
import { requirePortalUser } from "@/lib/session";
import { getPortalInvoice } from "@/server/queries";

type Params = Promise<{ id: string }>;

const LINE_COLS = "minmax(0,1fr) 44px 104px 104px";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requirePortalUser();
  const { id } = await params;
  const invoice = await getPortalInvoice(user.clientId, id);
  return { title: invoice?.number ?? "Invoice" };
}

export default async function PortalInvoicePage({ params }: { params: Params }) {
  const user = await requirePortalUser();
  const { id } = await params;

  const invoice = await getPortalInvoice(user.clientId, id);
  if (!invoice) notFound();

  const billName = invoice.client.company ?? invoice.client.name;
  const billAddress = [
    invoice.client.addressLine,
    [invoice.client.city, invoice.client.state].filter(Boolean).join(", "),
    [invoice.client.postalCode, invoice.client.country].filter(Boolean).join(" "),
    invoice.client.email,
  ]
    .filter((line) => line && line.trim() !== "")
    .join("\n");

  const paid = invoice.effectiveStatus === "PAID";

  return (
    <>
      <PortalHero
        title={invoice.number}
        sub={`Issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
        crumb={{ href: "/portal/invoices", label: "Invoices" }}
        action={<BandBadge value={invoice.effectiveStatus} />}
      />
      <PortalMain>
        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
          <PortalCard raised className="flex flex-col gap-6 p-[18px] min-[720px]:p-7">
            <div className="flex flex-wrap justify-between gap-5">
              <div>
                <div className="mb-1.5 text-[12.5px] text-fa">Billed to</div>
                <div className="text-[15px] font-medium">{billName}</div>
                <div className="text-[13.5px] leading-normal whitespace-pre-line text-mu">{billAddress}</div>
              </div>
              <div className="text-right">
                <div className="mb-1.5 text-[12.5px] text-fa">{paid ? "Amount paid" : "Amount due"}</div>
                <div className="text-[30px] font-semibold">{formatMoney(invoice.totals.totalCents)}</div>
                {paid && invoice.paidAt ? (
                  <div className="mt-0.5 text-[13px] text-grn">Received {formatDate(invoice.paidAt)}</div>
                ) : null}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <div className="grid gap-2.5 pb-2 text-[12px] text-fa" style={{ gridTemplateColumns: LINE_COLS }}>
                  <span>Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">Amount</span>
                </div>
                {invoice.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2.5 border-t border-ln py-3 text-[14px]"
                    style={{ gridTemplateColumns: LINE_COLS }}
                  >
                    <span>{item.description}</span>
                    <span className="text-right">{item.quantity}</span>
                    <span className="text-right">{formatMoney(item.unitPriceCents)}</span>
                    <span className="text-right">{formatMoney(lineTotalCents(item))}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[minmax(0,1fr)_130px] justify-items-end gap-x-2.5 gap-y-2 border-t border-ln pt-3.5 text-[14px]">
                  <span className="text-mu">Subtotal</span>
                  <span>{formatMoney(invoice.totals.subtotalCents)}</span>
                  <span className="text-mu">Tax ({invoice.taxRate}%)</span>
                  <span>{formatMoney(invoice.totals.taxCents)}</span>
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">{formatMoney(invoice.totals.totalCents)}</span>
                </div>
              </div>
            </div>

            {invoice.notes ? (
              <div className="rounded-[14px] bg-chip px-4 py-3.5 text-[13.5px] leading-normal whitespace-pre-line text-mu">
                {invoice.notes}
              </div>
            ) : null}
          </PortalCard>

          <div className="flex flex-col gap-4">
            <PortalCard>
              <PortalDetail term="Status" border="bottom">
                {label(invoice.effectiveStatus)}
              </PortalDetail>
              <PortalDetail term="Issued" border="bottom">
                {formatDate(invoice.issueDate)}
              </PortalDetail>
              <PortalDetail term="Due" border="bottom">
                {formatDate(invoice.dueDate)}
              </PortalDetail>
              {invoice.project ? (
                <Link href={`/portal/projects/${invoice.project.id}`} className="mt-3 block text-[13.5px]">
                  View {invoice.project.name} →
                </Link>
              ) : null}
            </PortalCard>
            <div className="rounded-[20px] bg-acs px-5 py-[18px] text-[13.5px] leading-[1.55]">
              Need a change to this invoice, or a copy for your finance team? Reply to your account manager and
              we&rsquo;ll sort it out.
            </div>
          </div>
        </div>
      </PortalMain>
    </>
  );
}
