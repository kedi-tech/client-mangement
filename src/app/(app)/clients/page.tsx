import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect, Pagination } from "@/components/filters";
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
import { CLIENT_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney, relativeTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { effectiveInvoiceStatus, invoiceTotals, isOutstanding } from "@/lib/invoice";

export const metadata: Metadata = { title: "Clients" };

const PAGE_SIZE = 12;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const ownerId = params.owner ?? "";
  const sort = params.sort ?? "recent";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  // Prisma's `mode: "insensitive"` is Postgres-only; SQLite's LIKE is already
  // case-insensitive for ASCII, so plain `contains` is the portable choice here.
  const where = {
    ...(status ? { status } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { email: { contains: q } },
            { industry: { contains: q } },
            { city: { contains: q } },
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

  const [total, clients, owners] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { contacts: true, projects: true } },
        invoices: { select: { status: true, dueDate: true, paidAt: true, taxRate: true, items: true } },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every company you work with, and where each one stands."
        actions={<LinkButton href="/clients/new">New client</LinkButton>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search name, company, email, city…" />
          </div>
          <FilterSelect
            name="status"
            label="Status"
            allLabel="Any status"
            options={CLIENT_STATUSES.map((value) => ({ value, label: label(value) }))}
          />
          <FilterSelect
            name="owner"
            label="Owner"
            allLabel="Anyone"
            options={owners.map((owner) => ({ value: owner.id, label: owner.name }))}
          />
          <FilterSelect
            name="sort"
            label="Sort"
            allLabel="Newest"
            options={[
              { value: "name", label: "Name" },
              { value: "status", label: "Status" },
            ]}
          />
        </div>

        {clients.length === 0 ? (
          <EmptyState
            title="No clients match those filters"
            description={
              q || status || ownerId
                ? "Try clearing the search or filters."
                : "Add your first client to start tracking work and invoices."
            }
            action={
              q || status || ownerId ? (
                <LinkButton href="/clients" variant="secondary">
                  Clear filters
                </LinkButton>
              ) : (
                <LinkButton href="/clients/new">New client</LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th>Owner</Th>
                  <Th className="text-right">Projects</Th>
                  <Th className="text-right">Outstanding</Th>
                  <Th>Added</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const outstandingCents = client.invoices
                    .filter((invoice) => isOutstanding(effectiveInvoiceStatus(invoice)))
                    .reduce(
                      (sum, invoice) => sum + invoiceTotals(invoice.items, invoice.taxRate).totalCents,
                      0,
                    );

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <Td>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                        >
                          {client.name}
                        </Link>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {[client.industry, client.city].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </Td>
                      <Td>
                        <Badge value={client.status} />
                      </Td>
                      <Td>{client.owner?.name ?? "Unassigned"}</Td>
                      <Td className="text-right tabular-nums">{client._count.projects}</Td>
                      <Td className="text-right tabular-nums">
                        {outstandingCents > 0 ? (
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatMoney(outstandingCents)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{relativeTime(client.createdAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} total={total} searchParams={params} />
          </>
        )}
      </Card>
    </>
  );
}
