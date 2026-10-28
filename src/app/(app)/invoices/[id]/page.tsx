import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/confirm-form";
import {
  Badge,
  Card,
  CardHeader,
  Crumbs,
  DetailList,
  DetailRow,
  LinkButton,
  MicroLabel,
  PageHeader,
  buttonClass,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals, lineTotalCents } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { viaClient } from "@/server/scope";
import { deleteInvoiceAction, setInvoiceStatusAction } from "@/server/actions/invoices";

type Params = Promise<{ id: string }>;

const LINE_COLS = "minmax(0,1fr) 70px 120px 120px";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const invoice = await prisma.invoice.findFirst({ where: { id, ...viaClient(user) }, select: { number: true } });
  return { title: invoice?.number ?? "Invoice" };
}

/** One-click status change; posts to the same action as every shortcut. */
function StatusButton({
  invoiceId,
  status,
  className,
  children,
}: {
  invoiceId: string;
  status: string;
  className: string;
  children: string;
}) {
  return (
    <form action={setInvoiceStatusAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

export default async function InvoiceDetailPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, ...viaClient(user) },
    include: {
      items: { orderBy: { position: "asc" } },
      client: true,
      project: { select: { id: true, name: true } },
    },
  });

  if (!invoice) notFound();

  const status = effectiveInvoiceStatus(invoice);
  const totals = invoiceTotals(invoice.items, invoice.taxRate);
  const settled = status === "PAID" || status === "VOID";

  const billName = invoice.client.company ?? invoice.client.name;
  const billAddress = [
    invoice.client.addressLine,
    [invoice.client.city, invoice.client.state].filter(Boolean).join(", "),
    [invoice.client.postalCode, invoice.client.country].filter(Boolean).join(" "),
    invoice.client.email,
  ]
    .filter((line) => line && line.trim() !== "")
    .join("\n");

  return (
    <>
      <PageHeader
        title={invoice.number}
        mono
        description={`Issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
        breadcrumb={
          <Crumbs
            items={[
              { href: "/invoices", label: "Invoices" },
              { href: `/clients/${invoice.client.id}`, label: invoice.client.name },
            ]}
          />
        }
        actions={
          <>
            {!settled && invoice.status === "DRAFT" ? (
              <StatusButton invoiceId={invoice.id} status="SENT" className={buttonClass("secondary")}>
                Mark sent
              </StatusButton>
            ) : null}
            {!settled ? (
              <StatusButton invoiceId={invoice.id} status="PAID" className={buttonClass("success")}>
                Mark paid
              </StatusButton>
            ) : null}
            <LinkButton href={`/invoices/${invoice.id}/edit`}>Edit</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex flex-col gap-6 p-4 min-[720px]:p-7">
          <div className="flex flex-wrap justify-between gap-5">
            <div>
              <MicroLabel className="mb-1.5">Bill to</MicroLabel>
              <div className="text-[14px] font-medium">{billName}</div>
              <div className="text-[13px] leading-normal whitespace-pre-line text-mu">{billAddress}</div>
            </div>
            <div className="text-right">
              <MicroLabel className="mb-1.5">Amount due</MicroLabel>
              <div className="font-mono text-[26px] font-medium">
                {formatMoney(status === "PAID" ? 0 : totals.totalCents)}
              </div>
              {status === "PAID" && invoice.paidAt ? (
                <div className="mt-0.5 text-[12.5px] text-grn">Paid {formatDate(invoice.paidAt)}</div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div
                className="grid gap-2.5 border-b border-tx py-2 text-[11px] tracking-[.05em] text-mu uppercase"
                style={{ gridTemplateColumns: LINE_COLS }}
              >
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Amount</span>
              </div>
              {invoice.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2.5 border-b border-l2 py-2.5 text-[13px]"
                  style={{ gridTemplateColumns: LINE_COLS }}
                >
                  <span>{item.description}</span>
                  <span className="text-right font-mono">{item.quantity}</span>
                  <span className="text-right font-mono">{formatMoney(item.unitPriceCents)}</span>
                  <span className="text-right font-mono">{formatMoney(lineTotalCents(item))}</span>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_130px] justify-items-end gap-x-2.5 gap-y-1.5 pt-3 text-[13px]">
                <span className="text-mu">Subtotal</span>
                <span className="font-mono">{formatMoney(totals.subtotalCents)}</span>
                <span className="text-mu">Tax ({invoice.taxRate}%)</span>
                <span className="font-mono">{formatMoney(totals.taxCents)}</span>
                <span className="font-semibold">Total</span>
                <span className="font-mono font-semibold">{formatMoney(totals.totalCents)}</span>
              </div>
            </div>
          </div>

          {invoice.notes ? (
            <div className="border-t border-l2 pt-3.5 text-[13px] leading-normal text-mu">
              <MicroLabel className="mb-1">Notes</MicroLabel>
              <span className="whitespace-pre-line">{invoice.notes}</span>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Status" action={<Badge value={status} />} />
          <DetailList className="pb-0">
            <DetailRow term="Client" termWidth={80}>
              <Link href={`/clients/${invoice.client.id}`}>{invoice.client.name}</Link>
            </DetailRow>
            <DetailRow term="Project" termWidth={80}>
              {invoice.project ? (
                <Link href={`/projects/${invoice.project.id}`}>{invoice.project.name}</Link>
              ) : (
                <span className="text-fa">—</span>
              )}
            </DetailRow>
            <DetailRow term="Issued" termWidth={80}>
              {formatDate(invoice.issueDate)}
            </DetailRow>
            <DetailRow term="Due" termWidth={80}>
              {formatDate(invoice.dueDate)}
            </DetailRow>
          </DetailList>
          <div className="flex flex-wrap gap-2 px-3.5 pt-3.5 pb-3.5">
            {status !== "VOID" ? (
              <StatusButton
                invoiceId={invoice.id}
                status="VOID"
                className={buttonClass("secondary", "sm", "px-2.5 py-[5px]")}
              >
                Void invoice
              </StatusButton>
            ) : (
              <StatusButton
                invoiceId={invoice.id}
                status="DRAFT"
                className={buttonClass("secondary", "sm", "px-2.5 py-[5px]")}
              >
                Reopen as draft
              </StatusButton>
            )}
            <ConfirmForm
              action={deleteInvoiceAction}
              hidden={{ invoiceId: invoice.id }}
              confirmMessage={`Delete invoice ${invoice.number}? This cannot be undone.`}
            >
              Delete
            </ConfirmForm>
          </div>
        </Card>
      </div>
    </>
  );
}
