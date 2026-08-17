import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { lineTotalCents } from "@/lib/invoice";
import { requirePortalUser } from "@/lib/session";
import { getPortalInvoice } from "@/server/queries";

type Params = Promise<{ id: string }>;

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

  const billTo = [
    invoice.client.company ?? invoice.client.name,
    invoice.client.addressLine,
    [invoice.client.city, invoice.client.state].filter(Boolean).join(", "),
    [invoice.client.postalCode, invoice.client.country].filter(Boolean).join(" "),
    invoice.client.email,
  ].filter((line) => line && line.trim() !== "");

  const paid = invoice.effectiveStatus === "PAID";

  return (
    <>
      <PageHeader
        title={invoice.number}
        description={`Issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
        breadcrumb={
          <Link href="/portal/invoices" className="hover:text-indigo-600 hover:underline">
            ← Invoices
          </Link>
        }
        actions={<Badge value={invoice.effectiveStatus} className="self-center" />}
      />

      <Card className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 px-6 py-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Billed to
            </p>
            <div className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
              {billTo.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {invoice.project ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Project:{" "}
                <Link
                  href={`/portal/projects/${invoice.project.id}`}
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {invoice.project.name}
                </Link>
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {paid ? "Amount paid" : "Amount due"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {formatMoney(invoice.totals.totalCents)}
            </p>
            {paid && invoice.paidAt ? (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Received {formatDate(invoice.paidAt)}
              </p>
            ) : null}
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Description</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Unit price</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <Td className="text-slate-900 dark:text-slate-100">{item.description}</Td>
                <Td className="text-right tabular-nums">{item.quantity}</Td>
                <Td className="text-right tabular-nums">{formatMoney(item.unitPriceCents)}</Td>
                <Td className="text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatMoney(lineTotalCents(item))}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="px-6 py-5">
          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
              <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(invoice.totals.subtotalCents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Tax ({invoice.taxRate}%)</dt>
              <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(invoice.totals.taxCents)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold dark:border-slate-800">
              <dt className="text-slate-900 dark:text-slate-100">Total</dt>
              <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(invoice.totals.totalCents)}
              </dd>
            </div>
          </dl>
        </div>

        {invoice.notes ? (
          <div className="border-t border-slate-200 px-6 py-5 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
              {invoice.notes}
            </p>
          </div>
        ) : null}
      </Card>

      <p className="mx-auto mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        Need a change to this invoice, or a copy for your finance team? Reply to your account
        manager and we'll sort it out.
      </p>
    </>
  );
}
