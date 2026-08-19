import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { INVOICE_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { like } from "@/lib/search";
import { formatDate, formatMoney } from "@/lib/format";
import { isOutstanding } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { invoicesWithTotals } from "@/server/queries";

export const metadata: Metadata = { title: "Invoices" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const clientId = params.clientId ?? "";

  const [allInvoices, clients] = await Promise.all([
    invoicesWithTotals({
      ...(clientId ? { clientId } : {}),
      ...(q
        ? { OR: [{ number: like(q) }, { client: { name: like(q) } }] }
        : {}),
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // Status is filtered after the fact because "overdue" is derived from the due
  // date rather than stored.
  const invoices = status
    ? allInvoices.filter((invoice) => invoice.effectiveStatus === status)
    : allInvoices;

  const outstandingCents = invoices
    .filter((invoice) => isOutstanding(invoice.effectiveStatus))
    .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0);
  const paidCents = invoices
    .filter((invoice) => invoice.effectiveStatus === "PAID")
    .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={`${formatMoney(outstandingCents)} outstanding · ${formatMoney(paidCents)} collected`}
        actions={<LinkButton href="/invoices/new">New invoice</LinkButton>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search by number or client…" />
          </div>
          <FilterSelect
            name="status"
            label="Status"
            allLabel="Any status"
            options={INVOICE_STATUSES.map((value) => ({ value, label: label(value) }))}
          />
          <FilterSelect
            name="clientId"
            label="Client"
            allLabel="All clients"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
          />
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices found"
            description="Bill a client for completed work to see it here."
            action={<LinkButton href="/invoices/new">New invoice</LinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <Td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {invoice.number}
                      </Link>
                      {invoice.project ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {invoice.project.name}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <Link
                        href={`/clients/${invoice.client.id}`}
                        className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                      >
                        {invoice.client.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge value={invoice.effectiveStatus} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(invoice.issueDate)}</Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(invoice.dueDate)}</Td>
                    <Td className="text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(invoice.totals.totalCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
