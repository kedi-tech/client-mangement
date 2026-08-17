import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/confirm-form";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals, lineTotalCents } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { deleteInvoiceAction, setInvoiceStatusAction } from "@/server/actions/invoices";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: invoice?.number ?? "Invoice" };
}

export default async function InvoiceDetailPage({ params }: { params: Params }) {
  await requireUser();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      client: true,
      project: { select: { id: true, name: true } },
    },
  });

  if (!invoice) notFound();

  const status = effectiveInvoiceStatus(invoice);
  const totals = invoiceTotals(invoice.items, invoice.taxRate);

  const billTo = [
    invoice.client.company ?? invoice.client.name,
    invoice.client.addressLine,
    [invoice.client.city, invoice.client.state].filter(Boolean).join(", "),
    [invoice.client.postalCode, invoice.client.country].filter(Boolean).join(" "),
    invoice.client.email,
  ].filter((line) => line && line.trim() !== "");

  return (
    <>
      <PageHeader
        title={invoice.number}
        description={`Issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
        breadcrumb={
          <span className="flex flex-wrap items-center gap-1">
            <Link href="/invoices" className="hover:text-indigo-600 hover:underline">
              Invoices
            </Link>
            <span>/</span>
            <Link
              href={`/clients/${invoice.client.id}`}
              className="hover:text-indigo-600 hover:underline"
            >
              {invoice.client.name}
            </Link>
          </span>
        }
        actions={
          <>
            <Badge value={status} className="self-center" />
            {status !== "PAID" && status !== "VOID" ? (
              <>
                {invoice.status === "DRAFT" ? (
                  <form action={setInvoiceStatusAction}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input type="hidden" name="status" value="SENT" />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Mark sent
                    </button>
                  </form>
                ) : null}
                <form action={setInvoiceStatusAction}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="status" value="PAID" />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Mark paid
                  </button>
                </form>
              </>
            ) : null}
            <LinkButton href={`/invoices/${invoice.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 px-6 py-6 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Bill to
                </p>
                <div className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
                  {billTo.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Amount due
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {status === "PAID" ? formatMoney(0) : formatMoney(totals.totalCents)}
                </p>
                {status === "PAID" && invoice.paidAt ? (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Paid {formatDate(invoice.paidAt)}
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
                    {formatMoney(totals.subtotalCents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Tax ({invoice.taxRate}%)</dt>
                  <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(totals.taxCents)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold dark:border-slate-800">
                  <dt className="text-slate-900 dark:text-slate-100">Total</dt>
                  <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(totals.totalCents)}
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Status</dt>
                <dd>
                  <Badge value={status} />
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Client</dt>
                <dd className="text-sm font-medium">
                  <Link
                    href={`/clients/${invoice.client.id}`}
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {invoice.client.name}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Project</dt>
                <dd className="text-sm font-medium">
                  {invoice.project ? (
                    <Link
                      href={`/projects/${invoice.project.id}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {invoice.project.name}
                    </Link>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">—</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Issued</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(invoice.issueDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Due</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(invoice.dueDate)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              {status !== "VOID" ? (
                <form action={setInvoiceStatusAction}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="status" value="VOID" />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Void invoice
                  </button>
                </form>
              ) : (
                <form action={setInvoiceStatusAction}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="status" value="DRAFT" />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Reopen as draft
                  </button>
                </form>
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
      </div>
    </>
  );
}
