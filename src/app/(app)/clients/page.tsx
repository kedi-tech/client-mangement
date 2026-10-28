import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, FilterSelect, Pagination } from "@/components/filters";
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
  Stack,
} from "@/components/ui";
import { CLIENT_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { like } from "@/lib/search";
import { formatMoney, relativeTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { clientScope } from "@/server/scope";
import { effectiveInvoiceStatus, invoiceTotals, isOutstanding } from "@/lib/invoice";
import { deleteClientAction } from "@/server/actions/clients";

export const metadata: Metadata = { title: "Clients" };

const PAGE_SIZE = 12;
const COLS = "minmax(220px,2fr) 100px 80px 120px 110px 190px";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const sort = params.sort ?? "recent";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...clientScope(user),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: like(q) },
            { company: like(q) },
            { email: like(q) },
            { industry: like(q) },
            { city: like(q) },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "name"
      ? ({ name: "asc" } as const)
      : sort === "status"
        ? ({ status: "asc" } as const)
        : ({ createdAt: "desc" } as const);

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { contacts: true, projects: true } },
        invoices: { select: { status: true, dueDate: true, paidAt: true, taxRate: true, items: true } },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone you work with, from first lead to archive."
        actions={<LinkButton href="/clients/new">New client</LinkButton>}
      />

      <FilterBar>
        <SearchInput placeholder="Search name, company, email, industry, city" />
        <FilterSelect
          name="status"
          label="Status"
          allLabel="Any status"
          options={CLIENT_STATUSES.map((value) => ({ value, label: label(value) }))}
        />
        <FilterSelect
          name="sort"
          label="Sort"
          allLabel="Newest"
          options={[
            { value: "name", label: "Name A–Z" },
            { value: "status", label: "Status" },
          ]}
        />
      </FilterBar>

      {clients.length === 0 ? (
        filtered ? (
          <EmptyBox
            title="No clients match those filters"
            action={
              <LinkButton href="/clients" variant="secondary">
                Clear filters
              </LinkButton>
            }
          />
        ) : (
          <EmptyBox
            title="Add your first client"
            description="Clients hold their contacts, projects, invoices and files in one place."
            action={<LinkButton href="/clients/new">New client</LinkButton>}
          />
        )
      ) : (
        <>
          <Card>
            <GridTable minWidth={840}>
              <GridHead cols={COLS}>
                <span>Client</span>
                <span>Status</span>
                <span className="text-right">Projects</span>
                <span className="text-right">Outstanding</span>
                <span>Added</span>
                <span className="text-right">Actions</span>
              </GridHead>
              {clients.map((client) => {
                const outstandingCents = client.invoices
                  .filter((invoice) => isOutstanding(effectiveInvoiceStatus(invoice)))
                  .reduce(
                    (sum, invoice) => sum + invoiceTotals(invoice.items, invoice.taxRate).totalCents,
                    0,
                  );

                return (
                  <GridRow key={client.id} cols={COLS}>
                    <Stack
                      primary={<Link href={`/clients/${client.id}`}>{client.name}</Link>}
                      secondary={[client.industry, client.city].filter(Boolean).join(" · ") || "—"}
                    />
                    <span>
                      <Badge value={client.status} />
                    </span>
                    <span className="text-right font-mono text-[12.5px]">{client._count.projects}</span>
                    <span className="text-right font-mono text-[12.5px]">
                      {outstandingCents > 0 ? formatMoney(outstandingCents) : "—"}
                    </span>
                    <span className="text-[12.5px] text-mu">{relativeTime(client.createdAt)}</span>
                    <RowActions
                      viewHref={`/clients/${client.id}`}
                      editHref={`/clients/${client.id}/edit`}
                      remove={{
                        action: deleteClientAction,
                        hidden: { clientId: client.id },
                        confirmMessage: `Delete ${client.name}? This also removes their contacts, projects, tasks and invoices. This cannot be undone.`,
                      }}
                    />
                  </GridRow>
                );
              })}
            </GridTable>
          </Card>
          <Pagination page={page} pageCount={pageCount} total={total} noun="client" searchParams={params} />
        </>
      )}
    </>
  );
}
