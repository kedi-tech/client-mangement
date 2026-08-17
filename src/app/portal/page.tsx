import type { Metadata } from "next";
import Link from "next/link";

import { FileList } from "@/components/file-list";
import { ProgressBar } from "@/components/progress-bar";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { getPortalOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Portal" };

export default async function PortalHomePage() {
  const user = await requirePortalUser();
  const data = await getPortalOverview(user.clientId);
  const { totals } = data;

  const activeProjects = data.projects.filter(
    (project) => project.status === "ACTIVE" || project.status === "PLANNING",
  );
  const unpaid = data.invoices
    .filter((invoice) => invoice.effectiveStatus === "SENT" || invoice.effectiveStatus === "OVERDUE")
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Your projects, invoices and shared files in one place."
        actions={<LinkButton href="/portal/files">Send us a file</LinkButton>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active projects</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {totals.activeProjects}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Balance due</p>
          <p
            className={
              totals.outstandingCents > 0
                ? "mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50"
                : "mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400"
            }
          >
            {formatMoney(totals.outstandingCents)}
          </p>
          {totals.overdueCount > 0 ? (
            <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
              {formatMoney(totals.overdueCents)} past due
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nothing past due</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Paid to date</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {formatMoney(totals.paidCents)}
          </p>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="Project progress"
            description="Live status of the work in flight"
            action={
              <Link
                href="/portal/projects"
                className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                All projects
              </Link>
            }
          />
          {activeProjects.length === 0 ? (
            <EmptyState
              title="No active projects"
              description="Once work starts, its progress will show up here."
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeProjects.map((project) => (
                <li key={project.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/portal/projects/${project.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {project.progress.total > 0
                          ? `${project.progress.done} of ${plural(project.progress.total, "step")} complete`
                          : "Not broken down yet"}
                        {project.endDate ? ` · target ${formatDate(project.endDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge value={project.status} />
                      {project.liveUrl ? (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Visit project
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            className="size-3.5"
                            aria-hidden
                          >
                            <path d="M14 4h6v6M20 4l-8 8M10 6H5v13h13v-5" />
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <ProgressBar
                    className="mt-3"
                    percent={project.progress.percent}
                    label={`${project.progress.percent}% complete`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Invoices due"
              action={
                <Link
                  href="/portal/invoices"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  All invoices
                </Link>
              }
            />
            {unpaid.length === 0 ? (
              <EmptyState title="Nothing due" description="Every invoice is settled — thank you." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {unpaid.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/portal/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {formatMoney(invoice.totals.totalCents)}
                      </span>
                      <Badge value={invoice.effectiveStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent files"
              action={
                <Link
                  href="/portal/files"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  All files
                </Link>
              }
            />
            <FileList
              files={data.files}
              perspective="portal"
              emptyTitle="No files yet"
              emptyDescription="Anything we share with you, and anything you send us, appears here."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
