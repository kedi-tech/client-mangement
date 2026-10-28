import type { Metadata } from "next";

import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  GridHead,
  GridRow,
  GridTable,
  PageHeader,
  ProgressBar,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { PROJECT_STATUSES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney, plural } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { taskScope, viaClient } from "@/server/scope";
import { getClientRollups, invoicesWithTotals } from "@/server/queries";

export const metadata: Metadata = { title: "Reports" };

const TOP_COLS = "minmax(180px,1.5fr) 100px 120px 120px 120px";

export default async function ReportsPage() {
  const user = await requireUser();

  const [rollups, invoices, projectCounts, taskCounts] = await Promise.all([
    getClientRollups(user),
    invoicesWithTotals(viaClient(user)),
    prisma.project.groupBy({
      by: ["status"],
      where: viaClient(user),
      _count: { _all: true },
      _sum: { budgetCents: true },
    }),
    prisma.task.groupBy({ by: ["status"], where: taskScope(user), _count: { _all: true } }),
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
      ? Math.round(invoices.reduce((sum, invoice) => sum + invoice.totals.totalCents, 0) / invoices.length)
      : 0;

  const doneTasks = taskCounts.find((row) => row.status === "DONE")?._count._all ?? 0;
  const allTasks = taskCounts.reduce((sum, row) => sum + row._count._all, 0);
  const deliveryPct = allTasks > 0 ? Math.round((doneTasks / allTasks) * 100) : 0;

  return (
    <>
      <PageHeader title="Reports" description="Money, pipeline and delivery across every client." />

      <StatGrid>
        <StatTile label="Billed to date" value={formatMoney(totalBilled)} sub="Excludes drafts and voids" />
        <StatTile
          label="Collected"
          value={formatMoney(totalCollected)}
          sub={`${collectionRate}% collection rate`}
          valueClassName="text-grn"
        />
        <StatTile
          label="Outstanding"
          value={formatMoney(totalOutstanding)}
          sub="Sent and overdue"
          valueClassName={totalOutstanding > 0 ? "text-red" : undefined}
        />
        <StatTile
          label="Average invoice"
          value={formatMoney(avgInvoiceCents)}
          sub={`Across ${plural(invoices.length, "invoice")}`}
         
        />
      </StatGrid>

      <Card>
        <CardHeader title="Top clients" />
        {topClients.length === 0 ? (
          <EmptyRow>No clients yet.</EmptyRow>
        ) : (
          <GridTable minWidth={640}>
            <GridHead cols={TOP_COLS}>
              <span>Client</span>
              <span>Status</span>
              <span className="text-right">Billed</span>
              <span className="text-right">Collected</span>
              <span className="text-right">Outstanding</span>
            </GridHead>
            {topClients.map((client) => (
              <GridRow key={client.id} cols={TOP_COLS} href={`/clients/${client.id}`} className="py-2">
                <span className="truncate">{client.name}</span>
                <span>
                  <Badge value={client.status} />
                </span>
                <span className="text-right font-mono text-[12.5px]">{formatMoney(client.billedCents)}</span>
                <span className="text-right font-mono text-[12.5px] text-grn">{formatMoney(client.paidCents)}</span>
                <span
                  className={`text-right font-mono text-[12.5px] ${client.outstandingCents > 0 ? "text-red" : "text-fa"}`}
                >
                  {client.outstandingCents > 0 ? formatMoney(client.outstandingCents) : "—"}
                </span>
              </GridRow>
            ))}
          </GridTable>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,.8fr)]">
        <Card>
          <CardHeader title="Pipeline by project status" />
          {PROJECT_STATUSES.map((status) => {
            const row = projectCounts.find((entry) => entry.status === status);
            return (
              <div
                key={status}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-l2 px-3.5 py-2 text-[12.5px] last:border-b-0"
              >
                <span>
                  <Badge value={status} />
                </span>
                <span className="font-mono">{formatMoney(row?._sum.budgetCents ?? 0)}</span>
                <span className="min-w-[72px] text-right text-fa">{plural(row?._count._all ?? 0, "project")}</span>
              </div>
            );
          })}
        </Card>

        <Card>
          <CardHeader title="Delivery" />
          <div className="flex flex-col gap-2.5 px-3.5 py-4">
            <div className="font-mono text-[26px] font-medium">{deliveryPct}%</div>
            <ProgressBar percent={deliveryPct} height={8} />
            <div className="text-[12.5px] text-mu">
              {doneTasks} of {plural(allTasks, "task")} complete
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenue by industry" />
          {industries.length === 0 ? (
            <EmptyRow>No clients yet.</EmptyRow>
          ) : (
            industries.map(([industry, data]) => (
              <div
                key={industry}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 border-b border-l2 px-3.5 py-2 text-[12.5px] last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate">{industry}</span>
                  <span className="block text-[11px] text-fa">{plural(data.count, "client")}</span>
                </span>
                <span className="self-center font-mono">{formatMoney(data.billedCents)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="text-[12px] text-fa">
        Billed totals exclude draft and voided invoices. Overdue status is derived from the due date.
      </div>
    </>
  );
}
