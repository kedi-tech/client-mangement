import type { Metadata } from "next";
import Link from "next/link";

import { TaskRow } from "@/components/task-row";
import {
  Badge,
  Card,
  CardHeader,
  Dot,
  EmptyRow,
  LinkButton,
  PageHeader,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { ACTIVITY_CATEGORY_TONES, activityCategory } from "@/lib/constants";
import { formatDate, formatMoney, formatMoneyCompact, plural, relativeTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Dashboard" };

/** Six bars on a ruled background; the peak month is drawn in the strong accent. */
function RevenueChart({ data }: { data: { label: string; cents: number }[] }) {
  const peak = Math.max(0, ...data.map((d) => d.cents));

  return (
    <div className="px-3.5 pt-4 pb-3">
      <div
        className="grid h-[132px] grid-cols-6 items-end gap-2.5"
        style={{
          background: "repeating-linear-gradient(transparent 0 32px, var(--grid) 32px 33px)",
        }}
      >
        {data.map((month) => {
          const height = month.cents > 0 ? Math.max(4, Math.round((month.cents / (peak || 1)) * 100)) : 1;
          return (
            <div
              key={month.label}
              title={`${month.label}: ${formatMoney(month.cents)}`}
              className="rounded-t-[2px]"
              style={{
                height: `${height}%`,
                background: month.cents === peak && peak > 0 ? "var(--bar)" : "var(--barc)",
              }}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-6 gap-2.5 pt-1.5 text-center font-mono text-[11px] text-mu">
        {data.map((month) => (
          <span key={month.label}>
            {month.label} {formatMoneyCompact(month.cents)}
          </span>
        ))}
      </div>
      <div className="mt-2 text-[11.5px] text-fa">
        Collected revenue by month · peak {formatMoney(peak)}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  const { stats } = data;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        actions={
          <>
            <LinkButton href="/clients/new" variant="secondary">
              New client
            </LinkButton>
            <LinkButton href="/invoices/new">New invoice</LinkButton>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Active clients"
          value={stats.activeClients}
          sub={`${stats.totalClients} total · ${stats.leads} leads`}
          href="/clients?status=ACTIVE"
        />
        <StatTile
          label="Active projects"
          value={stats.activeProjects}
          sub={`${stats.planningProjects} in planning`}
          href="/projects?status=ACTIVE"
        />
        <StatTile
          label="Outstanding"
          value={formatMoneyCompact(stats.outstandingCents)}
          sub={`${formatMoneyCompact(stats.collectedCents)} collected to date`}
          href="/invoices?status=SENT"
        />
        <StatTile
          label="Overdue invoices"
          value={stats.overdueCount}
          sub={stats.overdueCount ? `${formatMoney(stats.overdueCents)} past due` : "Nothing past due"}
          href="/invoices?status=OVERDUE"
          warn={stats.overdueCount > 0}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-2">
        <Card>
          <CardHeader title="Revenue" action={<Link href="/reports">Reports</Link>} />
          <RevenueChart data={data.revenueByMonth} />
        </Card>

        <Card>
          <CardHeader title="Invoices needing attention" action={<Link href="/invoices">All invoices</Link>} />
          {data.attentionInvoices.length === 0 ? (
            <EmptyRow center>Nothing outstanding</EmptyRow>
          ) : (
            data.attentionInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="grid grid-cols-[82px_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b border-l2 px-3.5 py-2 text-[12.5px] text-tx last:border-b-0 hover:bg-hov hover:text-tx"
              >
                <span className="font-mono">{invoice.number}</span>
                <span className="min-w-0">
                  <span className="block truncate">{invoice.client.name}</span>
                  <span className="block text-[11.5px] text-fa">Due {formatDate(invoice.dueDate)}</span>
                </span>
                <span className="text-right font-mono">{formatMoney(invoice.totals.totalCents)}</span>
                <Badge value={invoice.effectiveStatus} className="justify-self-end" />
              </Link>
            ))
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,.8fr)]">
        <Card>
          <CardHeader
            title="Tasks"
            action={
              <span className={stats.overdueTaskCount > 0 ? "text-red" : "text-mu"}>
                {stats.overdueTaskCount > 0 ? `${stats.overdueTaskCount} overdue` : "Nothing overdue"}
              </span>
            }
          />
          {data.upcomingTasks.length === 0 ? (
            <EmptyRow center>No open tasks</EmptyRow>
          ) : (
            data.upcomingTasks.map((task) => <TaskRow key={task.id} task={task} variant="dashboard" />)
          )}
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          {data.activity.length === 0 ? (
            <EmptyRow center>Nothing has happened yet</EmptyRow>
          ) : (
            data.activity.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[6px_minmax(0,1fr)] gap-2.5 border-b border-l2 px-3.5 py-2 last:border-b-0"
              >
                <Dot tone={ACTIVITY_CATEGORY_TONES[activityCategory(entry.type)]} />
                <div>
                  {entry.client ? (
                    <Link href={`/clients/${entry.client.id}`} className="text-[12.5px] leading-[1.4] text-tx">
                      {entry.message}
                    </Link>
                  ) : (
                    <span className="text-[12.5px] leading-[1.4]">{entry.message}</span>
                  )}
                  <div className="mt-0.5 text-[11px] text-fa">
                    {[entry.actor?.name ?? "System", entry.client?.name, relativeTime(entry.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <CardHeader title="Newest clients" />
          {data.recentClients.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 px-3.5 py-6 text-center">
              <span className="text-[13px] text-mu">No clients yet</span>
              <LinkButton href="/clients/new" className="text-[12.5px]">
                Add your first client
              </LinkButton>
            </div>
          ) : (
            data.recentClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex justify-between gap-2 border-b border-l2 px-3.5 py-2 text-tx last:border-b-0 hover:bg-hov hover:text-tx"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px]">{client.name}</span>
                  <span className="block text-[11px] text-fa">
                    {plural(client._count.projects, "project")} · {plural(client._count.contacts, "contact")}
                  </span>
                </span>
                <Badge value={client.status} className="self-center" />
              </Link>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
