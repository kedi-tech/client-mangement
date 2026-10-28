import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, FilterSelect } from "@/components/filters";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import {
  Badge,
  Card,
  EmptyBox,
  GridHead,
  GridRow,
  GridTable,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { INVOICE_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { isOutstanding } from "@/lib/invoice";
import { like } from "@/lib/search";
import { requireUser } from "@/lib/session";
import { deleteInvoiceAction } from "@/server/actions/invoices";
import { clientScope, viaClient } from "@/server/scope";
import { invoicesWithTotals } from "@/server/queries";

export const metadata: Metadata = { title: "Invoices" };

const COLS = "minmax(180px,1.4fr) minmax(150px,1fr) 90px 110px 110px 120px 190px";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const clientId = params.clientId ?? "";

  const [allInvoices, clients] = await Promise.all([
    invoicesWithTotals({
      ...viaClient(user),
      ...(clientId ? { clientId } : {}),
      ...(q ? { OR: [{ number: like(q) }, { client: { name: like(q) } }] } : {}),
    }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
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
  const filtered = Boolean(q || status || clientId);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={`${formatMoney(outstandingCents)} outstanding · ${formatMoney(paidCents)} collected`}
        actions={<LinkButton href="/invoices/new">New invoice</LinkButton>}
      />

      <FilterBar>
        <SearchInput placeholder="Search invoice number or client" className="flex-[1_1_240px]" />
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
      </FilterBar>

      {invoices.length === 0 ? (
        filtered ? (
          <EmptyBox
            title="No invoices match those filters"
            action={
              <LinkButton href="/invoices" variant="secondary">
                Clear filters
              </LinkButton>
            }
          />
        ) : (
          <EmptyBox
            title="No invoices yet"
            action={
              <LinkButton href="/invoices/new" variant="secondary">
                New invoice
              </LinkButton>
            }
          />
        )
      ) : (
        <>
          <Card>
            <GridTable minWidth={960}>
              <GridHead cols={COLS}>
                <span>Invoice</span>
                <span>Client</span>
                <span>Status</span>
                <span>Issued</span>
                <span>Due</span>
                <span className="text-right">Total</span>
                <span className="text-right">Actions</span>
              </GridHead>
              {invoices.map((invoice) => (
                <GridRow key={invoice.id} cols={COLS}>
                  <span className="min-w-0">
                    <Link href={`/invoices/${invoice.id}`} className="block font-mono text-[12.5px]">
                      {invoice.number}
                    </Link>
                    <span className="block truncate text-[11.5px] text-fa">{invoice.project?.name ?? ""}</span>
                  </span>
                  <span className="truncate text-mu">{invoice.client.name}</span>
                  <span>
                    <Badge value={invoice.effectiveStatus} />
                  </span>
                  <span className="text-[12.5px] text-mu">{formatDate(invoice.issueDate)}</span>
                  <span className="text-[12.5px] text-mu">{formatDate(invoice.dueDate)}</span>
                  <span className="text-right font-mono text-[12.5px]">
                    {formatMoney(invoice.totals.totalCents)}
                  </span>
                  <RowActions
                    viewHref={`/invoices/${invoice.id}`}
                    editHref={`/invoices/${invoice.id}/edit`}
                    remove={{
                      action: deleteInvoiceAction,
                      hidden: { invoiceId: invoice.id },
                      confirmMessage: `Delete invoice ${invoice.number}? This cannot be undone.`,
                    }}
                  />
                </GridRow>
              ))}
            </GridTable>
          </Card>
          <div className="text-[12.5px] text-mu">{plural(invoices.length, "invoice")}</div>
        </>
      )}
    </>
  );
}
