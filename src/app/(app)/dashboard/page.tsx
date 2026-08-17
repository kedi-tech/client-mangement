import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { TaskRow } from "@/components/task-row";
import { formatDate, formatMoney, formatMoneyCompact, relativeTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Dashboard" };

function StatTile({
  label,
  value,
  sub,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  tone?: "default" | "warning";
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={
          tone === "warning"
            ? "mt-2 text-2xl font-semibold tracking-tight text-rose-600 dark:text-rose-400"
            : "mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50"
        }
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </Link>
  );
}

/** Pure-CSS bar chart — no client JS, reads correctly in both themes. */
function RevenueChart({ data }: { data: { label: string; cents: number }[] }) {
  const max = Math.max(...data.map((d) => d.cents), 1);

  return (
    <div className="px-5 py-5">
      {/* The column must be full-height: a percentage bar inside an auto-height
          parent collapses to nothing. */}
      <div className="flex h-40 gap-3">
        {data.map((month) => (
          <div key={month.label} className="flex h-full flex-1 flex-col items-center gap-2">
            <div className="flex w-full min-h-0 flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-indigo-500/80 dark:bg-indigo-500/60"
                style={{ height: `${Math.max((month.cents / max) * 100, month.cents > 0 ? 4 : 1)}%` }}
                title={`${month.label}: ${formatMoney(month.cents)}`}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{month.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Collected revenue by month · peak {formatMoneyCompact(max)}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData();
  const { stats } = data;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Everything that needs your attention today."
        actions={
          <>
            <LinkButton href="/clients/new" variant="secondary">
              New client
            </LinkButton>
            <LinkButton href="/invoices/new">New invoice</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active clients"
          value={String(stats.activeClients)}
          sub={`${stats.totalClients} total · ${stats.leads} leads`}
          href="/clients?status=ACTIVE"
        />
        <StatTile
          label="Active projects"
          value={String(stats.activeProjects)}
          sub={`${stats.planningProjects} in planning`}
          href="/projects?status=ACTIVE"
        />
        <StatTile
          label="Outstanding"
          value={formatMoneyCompact(stats.outstandingCents)}
          sub={`${formatMoney(stats.collectedCents)} collected to date`}
          href="/invoices?status=SENT"
        />
        <StatTile
          label="Overdue invoices"
          value={String(stats.overdueCount)}
          sub={stats.overdueCount ? `${formatMoney(stats.overdueCents)} past due` : "Nothing past due"}
          href="/invoices?status=OVERDUE"
          tone={stats.overdueCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Revenue"
              description="Last six months of paid invoices"
              action={
                <Link
                  href="/reports"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Reports
                </Link>
              }
            />
            <RevenueChart data={data.revenueByMonth} />
          </Card>

          <Card>
            <CardHeader
              title="Tasks"
              description={
                stats.overdueTaskCount > 0
                  ? `${stats.overdueTaskCount} overdue`
                  : "Nothing overdue"
              }
              action={
                <Link
                  href="/tasks"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  All tasks
                </Link>
              }
            />
            {data.upcomingTasks.length === 0 ? (
              <EmptyState
                title="No open tasks"
                description="Every task is complete. Create one to keep the next step visible."
                action={<LinkButton href="/tasks">Go to tasks</LinkButton>}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.upcomingTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Invoices needing attention"
              description="Sent or past due and still unpaid"
              action={
                <Link
                  href="/invoices"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  All invoices
                </Link>
              }
            />
            {data.attentionInvoices.length === 0 ? (
              <EmptyState title="Nothing outstanding" description="Every invoice is settled." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.attentionInvoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {invoice.number}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {invoice.client.name} · due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(invoice.totals.totalCents)}
                      </span>
                      <Badge value={invoice.effectiveStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent activity" />
            {data.activity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.activity.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {entry.client ? (
                        <Link
                          href={`/clients/${entry.client.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                        >
                          {entry.message}
                        </Link>
                      ) : (
                        entry.message
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {entry.actor?.name ?? "System"} · {relativeTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Newest clients"
              action={
                <Link
                  href="/clients"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  All clients
                </Link>
              }
            />
            {data.recentClients.length === 0 ? (
              <EmptyState
                title="No clients yet"
                action={<LinkButton href="/clients/new">Add your first client</LinkButton>}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentClients.map((client) => (
                  <li key={client.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/clients/${client.id}`}
                        className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {client.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {client._count.projects} projects · {client._count.contacts} contacts
                      </p>
                    </div>
                    <Badge value={client.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
