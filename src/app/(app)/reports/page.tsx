import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { PROJECT_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getClientRollups, invoicesWithTotals } from "@/server/queries";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireUser();

  const [rollups, invoices, projectCounts, taskCounts] = await Promise.all([
    getClientRollups(),
    invoicesWithTotals(),
    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { budgetCents: true },
    }),
    prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const topClients = [...rollups].sort((a, b) => b.billedCents - a.billedCents).slice(0, 10);

  const byIndustry = new Map<string, { count: number; billedCents: number }>();
  for (const client of rollups) {
    const key = client.industry?.trim() || "Unspecified";
    const entry = byIndustry.get(key) ?? { count: 0, billedCents: 0 };
    entry.count += 1;
    entry.billedCents += client.billedCents;
    byIndustry.set(key, entry);
  }
  const industries = [...byIndustry.entries()].sort((a, b) => b[1].billedCents - a[1].billedCents);

  const totalBilled = rollups.reduce((sum, client) => sum + client.billedCents, 0);
  const totalCollected = rollups.reduce((sum, client) => sum + client.paidCents, 0);
  const totalOutstanding = rollups.reduce((sum, client) => sum + client.outstandingCents, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  const avgInvoiceCents =
    invoices.length > 0
      ? Math.round(
          invoices.reduce((sum, invoice) => sum + invoice.totals.totalCents, 0) / invoices.length,
        )
      : 0;

  const doneTasks = taskCounts.find((row) => row.status === "DONE")?._count._all ?? 0;
  const allTasks = taskCounts.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Revenue, pipeline and delivery across the whole workspace."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Billed to date</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {formatMoney(totalBilled)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Collected</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {collectionRate}% collection rate
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">
            {formatMoney(totalOutstanding)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Average invoice</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {formatMoney(avgInvoiceCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            across {invoices.length} invoices
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Top clients by revenue" description="Billed, collected and outstanding" />
          {topClients.length === 0 ? (
            <EmptyState title="No client data yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Billed</Th>
                  <Th className="text-right">Collected</Th>
                  <Th className="text-right">Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <Td>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {client.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge value={client.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(client.billedCents)}</Td>
                    <Td className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(client.paidCents)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {client.outstandingCents > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {formatMoney(client.outstandingCents)}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Project pipeline" />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {PROJECT_STATUSES.map((status) => {
                const row = projectCounts.find((entry) => entry.status === status);
                return (
                  <li key={status} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge value={status} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatMoney(row?._sum.budgetCents ?? 0)}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {row?._count._all ?? 0}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Delivery" />
            <div className="px-5 py-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${allTasks > 0 ? (doneTasks / allTasks) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                {doneTasks} of {allTasks} tasks complete
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Revenue by industry" />
            {industries.length === 0 ? (
              <EmptyState title="No data yet" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {industries.map(([industry, data]) => (
                  <li key={industry} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {industry}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {data.count} {data.count === 1 ? "client" : "clients"}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(data.billedCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Billed totals exclude draft and voided invoices. {label("OVERDUE")} status is derived from
        the due date.
      </p>
    </>
  );
}
